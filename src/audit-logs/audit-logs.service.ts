import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RequestUser } from '../auth/types/jwt-payload';
import { AuditLog } from '../cases/entities/audit-log.entity';
import { assertAuditAccess } from '../reporting/reporting.scope';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs.query.dto';

@Injectable()
export class AuditLogsService {
  constructor(
    @InjectRepository(AuditLog, 'workspace')
    private readonly logs: Repository<AuditLog>,
  ) {}

  async list(actor: RequestUser, query: ListAuditLogsQueryDto) {
    assertAuditAccess(actor);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;

    const qb = this.logs.createQueryBuilder('a').orderBy('a.createdAt', 'DESC');

    if (actor.roleCode !== 'superadmin') {
      qb.andWhere('a.departmentId = :deptId', { deptId: actor.departmentId });
    }
    if (query.module?.trim()) {
      qb.andWhere('a.module = :module', { module: query.module.trim() });
    }
    if (query.action?.trim()) {
      qb.andWhere('a.action = :action', { action: query.action.trim() });
    }
    if (query.userId?.trim()) {
      qb.andWhere('a.userId = :userId', { userId: query.userId.trim() });
    }
    if (query.from) {
      qb.andWhere('a.createdAt >= :from', { from: new Date(query.from) });
    }
    if (query.to) {
      const end = new Date(query.to);
      end.setHours(23, 59, 59, 999);
      qb.andWhere('a.createdAt <= :to', { to: end });
    }

    const [rows, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return {
      data: rows.map((a) => ({
        id: String(a.id),
        userId: a.userId != null ? String(a.userId) : null,
        roleCode: a.roleCode,
        departmentId: a.departmentId != null ? String(a.departmentId) : null,
        action: a.action,
        module: a.module,
        subjectType: a.subjectType,
        subjectId: a.subjectId != null ? String(a.subjectId) : null,
        ip: a.ip,
        createdAt: a.createdAt,
      })),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize) || 1),
      },
    };
  }
}
