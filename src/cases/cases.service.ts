import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { RequestUser } from '../auth/types/jwt-payload';
import { HandoffRule } from '../departments/entities/handoff-rule.entity';
import { Department } from '../users/entities/department.entity';
import { User } from '../users/entities/user.entity';
import { canTransition } from './case-transitions';
import { BulkAssignDto } from './dto/bulk-assign.dto';
import { CreateCaseDto } from './dto/create-case.dto';
import { CreateCaseNoteDto } from './dto/create-case-note.dto';
import { HandoffCaseDto } from './dto/handoff-case.dto';
import { ListCasesQueryDto } from './dto/list-cases.query.dto';
import { UpdateCaseDto } from './dto/update-case.dto';
import { AuditLog } from './entities/audit-log.entity';
import { CaseEntity } from './entities/case.entity';
import { CaseCategory } from './entities/case-category.entity';
import { CaseHandoff } from './entities/case-handoff.entity';
import { CaseNote } from './entities/case-note.entity';
import { SlaRule } from './entities/sla-rule.entity';
import { mapCase, mapCaseDetail, mapNote } from './cases.mapper';
import { computeSlaBand } from './sla.util';

@Injectable()
export class CasesService {
  constructor(
    @InjectRepository(CaseEntity, 'workspace')
    private readonly cases: Repository<CaseEntity>,
    @InjectRepository(CaseCategory, 'workspace')
    private readonly categories: Repository<CaseCategory>,
    @InjectRepository(CaseNote, 'workspace')
    private readonly notes: Repository<CaseNote>,
    @InjectRepository(CaseHandoff, 'workspace')
    private readonly handoffs: Repository<CaseHandoff>,
    @InjectRepository(SlaRule, 'workspace')
    private readonly slaRules: Repository<SlaRule>,
    @InjectRepository(HandoffRule, 'workspace')
    private readonly handoffRules: Repository<HandoffRule>,
    @InjectRepository(Department, 'workspace')
    private readonly departments: Repository<Department>,
    @InjectRepository(User, 'workspace')
    private readonly users: Repository<User>,
    @InjectRepository(AuditLog, 'workspace')
    private readonly auditLogs: Repository<AuditLog>,
  ) {}

  async list(actor: RequestUser, query: ListCasesQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    // Refresh SLA bands for open cases in scope (lightweight for Phase 3 volume)
    await this.refreshSlaBands();

    const qb = this.cases
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.category', 'category')
      .leftJoinAndSelect('c.department', 'department')
      .leftJoinAndSelect('c.assignee', 'assignee')
      .orderBy('c.openedAt', 'DESC');

    const queue = query.queue ?? 'all';
    // Outgoing handoffs live in the destination dept; scope by last handoff.from instead.
    if (queue === 'outgoing_handoffs' && actor.roleCode !== 'superadmin') {
      if (!actor.departmentId) {
        throw new ForbiddenException('No department scope');
      }
      qb.andWhere('c.status = :ho', { ho: 'Handed Off' }).andWhere(
        `EXISTS (
          SELECT 1 FROM case_handoffs h
          WHERE h.case_id = c.id
            AND h.from_department_id = :outFrom
            AND h.id = (
              SELECT MAX(h2.id) FROM case_handoffs h2 WHERE h2.case_id = c.id
            )
        )`,
        { outFrom: actor.departmentId },
      );
    } else {
      this.applyDepartmentScope(qb, actor, query.department);
      this.applyQueue(qb, actor, queue);
    }

    if (query.status) {
      qb.andWhere('c.status = :status', { status: query.status });
    }
    if (query.priority) {
      qb.andWhere('c.priority = :priority', { priority: query.priority });
    }
    if (query.q?.trim()) {
      const q = `%${query.q.trim()}%`;
      qb.andWhere(
        new Brackets((w) => {
          w.where('c.caseNo LIKE :q', { q }).orWhere(
            'category.name LIKE :q',
            { q },
          );
        }),
      );
    }

    const [rows, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return {
      data: rows.map(mapCase),
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async findOne(actor: RequestUser, id: string) {
    const c = await this.loadCase(id);
    this.assertCanAccess(actor, c);
    c.slaBand = await this.recomputeAndPersistSla(c);
    return mapCaseDetail(c);
  }

  async create(actor: RequestUser, dto: CreateCaseDto) {
    this.assertStaff(actor);

    const category = await this.categories.findOne({
      where: { id: dto.categoryId },
    });
    if (!category || category.status !== 'active') {
      throw new NotFoundException(`Category ${dto.categoryId} not found`);
    }

    let department = category.defaultDepartment;
    if (dto.departmentId) {
      if (actor.roleCode !== 'superadmin') {
        throw new ForbiddenException(
          'Only superadmin can override case department',
        );
      }
      department = await this.requireDepartment(dto.departmentId);
    } else if (
      actor.roleCode === 'department_admin' &&
      actor.departmentId &&
      String(department.id) !== actor.departmentId
    ) {
      // Dept admin may create only into their own department unless category already routes there
      throw new ForbiddenException(
        'Category routes to another department; ask superadmin to create or change category',
      );
    }

    let assignee: User | null = null;
    let status = 'New';
    if (dto.assigneeUserId) {
      assignee = await this.requireUser(dto.assigneeUserId);
      status = 'Assigned';
    }

    const priority = dto.priority ?? 'Normal';
    const openedAt = new Date();
    const slaBand = await this.bandFor(priority, openedAt);
    const caseNo = await this.nextCaseNo();

    const createdBy = await this.users.findOne({ where: { id: actor.id } });

    const entity = await this.cases.save(
      this.cases.create({
        caseNo,
        category,
        department,
        assignee,
        status,
        priority,
        slaBand,
        openedAt,
        closedAt: null,
        sourceClientId: dto.sourceClientId ?? null,
        sourceUnitsaleId: dto.sourceUnitsaleId ?? null,
        sourceUnitId: dto.sourceUnitId ?? null,
        sourceReceiptId: dto.sourceReceiptId ?? null,
        createdBy,
      }),
    );

    if (dto.note?.trim()) {
      await this.notes.save(
        this.notes.create({
          case: entity,
          user: createdBy!,
          body: dto.note.trim(),
          clientVisible: false,
        }),
      );
    }

    await this.writeAudit(actor, 'case.create', entity.id);
    const loaded = await this.loadCase(String(entity.id));
    return mapCaseDetail(loaded);
  }

  async update(actor: RequestUser, id: string, dto: UpdateCaseDto) {
    const c = await this.loadCase(id);
    this.assertCanAccess(actor, c);
    this.assertStaff(actor);

    if (dto.status !== undefined && dto.status !== c.status) {
      if (!canTransition(c.status, dto.status)) {
        throw new UnprocessableEntityException(
          `Illegal status transition: ${c.status} → ${dto.status}`,
        );
      }
      const prev = c.status;
      c.status = dto.status;
      if (dto.status === 'Closed' || dto.status === 'Resolved') {
        c.closedAt = c.closedAt ?? new Date();
      }
      if (dto.status === 'Reopened') {
        c.closedAt = null;
        c.openedAt = new Date();
      }
      await this.writeAudit(actor, 'case.status_change', c.id, {
        from: prev,
        to: dto.status,
      });
    }

    if (dto.priority !== undefined && dto.priority !== c.priority) {
      c.priority = dto.priority;
    }

    if (dto.assigneeUserId !== undefined) {
      if (dto.assigneeUserId === null || dto.assigneeUserId === '') {
        c.assignee = null;
      } else {
        c.assignee = await this.requireUser(dto.assigneeUserId);
        if (c.status === 'New') {
          if (!canTransition('New', 'Assigned')) {
            throw new UnprocessableEntityException(
              'Illegal status transition: New → Assigned',
            );
          }
          c.status = 'Assigned';
          await this.writeAudit(actor, 'case.status_change', c.id, {
            from: 'New',
            to: 'Assigned',
          });
        }
      }
      await this.writeAudit(actor, 'case.assign', c.id);
    }

    c.slaBand = await this.bandFor(c.priority, c.openedAt);
    await this.cases.save(c);
    return mapCase(await this.loadCase(id));
  }

  async addNote(actor: RequestUser, id: string, dto: CreateCaseNoteDto) {
    const c = await this.loadCase(id);
    this.assertCanAccess(actor, c);
    this.assertStaff(actor);
    const user = await this.requireUser(actor.id);
    const note = await this.notes.save(
      this.notes.create({
        case: c,
        user,
        body: dto.body,
        clientVisible: dto.clientVisible ?? false,
      }),
    );
    await this.writeAudit(actor, 'case.note', c.id);
    return mapNote(note);
  }

  async handoff(actor: RequestUser, id: string, dto: HandoffCaseDto) {
    const c = await this.loadCase(id);
    this.assertCanAccess(actor, c);
    this.assertStaff(actor);

    const fromDept = c.department;
    const toDept = await this.requireDepartment(dto.toDepartmentId);
    if (String(fromDept.id) === String(toDept.id)) {
      throw new UnprocessableEntityException(
        'Cannot hand off to the same department',
      );
    }

    if (actor.roleCode !== 'superadmin') {
      const rule = await this.handoffRules.findOne({
        where: {
          fromDepartment: { id: fromDept.id },
          toDepartment: { id: toDept.id },
        },
      });
      if (!rule || !rule.isAllowed) {
        throw new UnprocessableEntityException(
          `Handoff blocked by rules: ${fromDept.code} → ${toDept.code}`,
        );
      }
    }

    if (!canTransition(c.status, 'Handed Off')) {
      throw new UnprocessableEntityException(
        `Illegal status transition: ${c.status} → Handed Off`,
      );
    }

    const byUser = await this.requireUser(actor.id);
    const prev = c.status;
    const slaBand = await this.bandFor(c.priority, c.openedAt);

    await this.handoffs
      .createQueryBuilder()
      .insert()
      .into(CaseHandoff)
      .values({
        case: { id: c.id },
        fromDepartment: { id: fromDept.id },
        toDepartment: { id: toDept.id },
        byUser: { id: byUser.id },
        note: dto.note ?? null,
      })
      .execute();

    // Avoid saving the loaded graph (TypeORM can null inverse FKs on OneToMany)
    await this.cases
      .createQueryBuilder()
      .update(CaseEntity)
      .set({
        department: { id: toDept.id },
        status: 'Handed Off',
        assignee: null,
        slaBand,
      })
      .where('id = :id', { id: c.id })
      .execute();

    await this.writeAudit(actor, 'case.handoff', c.id, {
      from: fromDept.code,
      to: toDept.code,
      statusFrom: prev,
    });

    return mapCaseDetail(await this.loadCase(id));
  }

  async bulkAssign(actor: RequestUser, dto: BulkAssignDto) {
    if (actor.roleCode !== 'superadmin') {
      throw new ForbiddenException('Only superadmin can bulk-assign');
    }
    const assignee = await this.requireUser(dto.assigneeUserId);
    const updated: string[] = [];
    for (const caseId of dto.caseIds) {
      const c = await this.loadCase(caseId);
      c.assignee = assignee;
      if (c.status === 'New' && canTransition('New', 'Assigned')) {
        c.status = 'Assigned';
      }
      c.slaBand = await this.bandFor(c.priority, c.openedAt);
      await this.cases.save(c);
      await this.writeAudit(actor, 'case.bulk_assign', c.id);
      updated.push(String(c.id));
    }
    return { ok: true, updated };
  }

  async exportCsv(actor: RequestUser, query: ListCasesQueryDto) {
    const result = await this.list(actor, {
      ...query,
      page: 1,
      pageSize: 1000,
    });
    const header = [
      'caseNo',
      'status',
      'priority',
      'slaBand',
      'department',
      'category',
      'assignee',
      'openedAt',
    ];
    const lines = [header.join(',')];
    for (const row of result.data) {
      lines.push(
        [
          row.caseNo,
          row.status,
          row.priority,
          row.slaBand,
          row.department?.code ?? '',
          row.category?.name ?? '',
          row.assignee?.email ?? '',
          row.openedAt ? new Date(row.openedAt).toISOString() : '',
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(','),
      );
    }
    return lines.join('\n');
  }

  private applyDepartmentScope(
    qb: ReturnType<Repository<CaseEntity>['createQueryBuilder']>,
    actor: RequestUser,
    departmentFilter?: string,
  ) {
    if (actor.roleCode === 'superadmin') {
      if (departmentFilter) {
        qb.andWhere(
          '(department.id = :deptFilter OR department.code = :deptFilter)',
          { deptFilter: departmentFilter },
        );
      }
      return;
    }
    if (!actor.departmentId) {
      throw new ForbiddenException('No department scope');
    }
    qb.andWhere('department.id = :scopeDept', {
      scopeDept: actor.departmentId,
    });
  }

  private applyQueue(
    qb: ReturnType<Repository<CaseEntity>['createQueryBuilder']>,
    actor: RequestUser,
    queue: string,
  ) {
    switch (queue) {
      case 'unassigned':
        qb.andWhere('c.assignee_user_id IS NULL');
        break;
      case 'overdue':
        qb.andWhere('c.slaBand = :breached', { breached: 'Breached' });
        break;
      case 'closed':
        qb.andWhere('c.status IN (:...closed)', {
          closed: ['Resolved', 'Closed'],
        });
        break;
      case 'assigned':
        qb.andWhere('c.status = :assigned', { assigned: 'Assigned' });
        break;
      case 'waiting_on_client':
        qb.andWhere('c.status = :woc', { woc: 'Waiting on Client' });
        break;
      case 'incoming_handoffs':
        qb.andWhere('c.status = :ho', { ho: 'Handed Off' });
        // already scoped to current department for non-superadmin
        break;
      case 'outgoing_handoffs':
        qb.andWhere('c.status = :ho', { ho: 'Handed Off' });
        if (actor.departmentId) {
          qb.andWhere(
            `EXISTS (
              SELECT 1 FROM case_handoffs h
              WHERE h.case_id = c.id
                AND h.from_department_id = :outFrom
                AND h.id = (
                  SELECT MAX(h2.id) FROM case_handoffs h2 WHERE h2.case_id = c.id
                )
            )`,
            { outFrom: actor.departmentId },
          );
        }
        break;
      case 'all':
      default:
        break;
    }
  }

  private async nextCaseNo(): Promise<string> {
    const raw = await this.cases
      .createQueryBuilder('c')
      .select('MAX(c.caseNo)', 'max')
      .getRawOne<{ max: string | null }>();
    const max = raw?.max ?? 'BK-1003000';
    const num = Number(max.replace(/^BK-/, '')) || 1003000;
    return `BK-${num + 1}`;
  }

  private async bandFor(priority: string, openedAt: Date) {
    const rule = await this.slaRules.findOne({
      where: { priority, status: 'active' },
    });
    const targetHours = rule?.targetHours ?? 48;
    const escalate = rule?.escalateAtPercent ?? 80;
    return computeSlaBand(openedAt, targetHours, escalate);
  }

  private async recomputeAndPersistSla(c: CaseEntity) {
    const band = await this.bandFor(c.priority, c.openedAt);
    if (band !== c.slaBand) {
      c.slaBand = band;
      await this.cases.save(c);
    }
    return band;
  }

  private async refreshSlaBands() {
    const open = await this.cases
      .createQueryBuilder('c')
      .where('c.status NOT IN (:...done)', { done: ['Closed', 'Resolved'] })
      .getMany();
    for (const c of open) {
      const band = await this.bandFor(c.priority, c.openedAt);
      if (band !== c.slaBand) {
        c.slaBand = band;
        await this.cases.save(c);
      }
    }
  }

  private async loadCase(id: string): Promise<CaseEntity> {
    const c = await this.cases.findOne({
      where: { id },
      relations: [
        'category',
        'department',
        'assignee',
        'notes',
        'notes.user',
        'handoffs',
        'handoffs.fromDepartment',
        'handoffs.toDepartment',
        'handoffs.byUser',
      ],
      order: {
        notes: { createdAt: 'ASC' },
        handoffs: { createdAt: 'ASC' },
      },
    });
    if (!c) throw new NotFoundException(`Case ${id} not found`);
    return c;
  }

  private assertStaff(actor: RequestUser) {
    if (!['superadmin', 'department_admin', 'employee'].includes(actor.roleCode)) {
      throw new ForbiddenException('Insufficient role');
    }
  }

  private assertCanAccess(actor: RequestUser, c: CaseEntity) {
    this.assertStaff(actor);
    if (actor.roleCode === 'superadmin') return;
    if (!actor.departmentId || String(c.department.id) !== actor.departmentId) {
      throw new ForbiddenException('Case is outside your department');
    }
  }

  private async requireDepartment(id: string) {
    const d = await this.departments.findOne({ where: { id } });
    if (!d) throw new NotFoundException(`Department ${id} not found`);
    return d;
  }

  private async requireUser(id: string) {
    const u = await this.users.findOne({ where: { id } });
    if (!u) throw new NotFoundException(`User ${id} not found`);
    return u;
  }

  private async writeAudit(
    actor: RequestUser,
    action: string,
    subjectId: string,
    _meta?: Record<string, string>,
  ) {
    await this.auditLogs.save(
      this.auditLogs.create({
        userId: actor.id,
        roleCode: actor.roleCode,
        departmentId: actor.departmentId,
        action,
        module: 'cases',
        subjectType: 'case',
        subjectId,
        ip: null,
      }),
    );
  }
}
