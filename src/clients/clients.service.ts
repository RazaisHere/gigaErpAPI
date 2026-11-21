import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { RequestUser } from '../auth/types/jwt-payload';
import { AuditLog } from '../cases/entities/audit-log.entity';
import { CaseEntity } from '../cases/entities/case.entity';
import { mapCase } from '../cases/cases.mapper';
import { ListClientsQueryDto } from './dto/list-clients.query.dto';
import { VerifyClientDto } from './dto/verify-client.dto';
import { ClientLink } from './entities/client-link.entity';
import {
  CNIC_REGEX,
  MOBILE_REGEX,
} from './validators/pk-contact.validator';

type SrcClientRow = {
  id: number;
  person: string | null;
  email: string | null;
  mobile_number: string | null;
  work_phone: string | null;
  cnic: string | null;
  billing_address: string | null;
};

type SrcSaleRow = {
  source_unitsale_id: number;
  source_client_id: number;
  client_name: string | null;
  cnic: string | null;
  mobile_number: string | null;
  email: string | null;
  source_unit_id: number | null;
  unitname: string | null;
  buildingname: string | null;
  projectname: string | null;
  sale_number: string | null;
  booking_date: Date | null;
  net_price: number | null;
  net_receipts: number | null;
  current_outstanding: number | null;
  sale_status_id: number | null;
};

const ACTION_TO_STATUS: Record<VerifyClientDto['action'], string> = {
  approve: 'approved',
  reject: 'rejected',
  request_information: 'request_information',
  under_review: 'under_review',
};

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(ClientLink, 'workspace')
    private readonly links: Repository<ClientLink>,
    @InjectRepository(CaseEntity, 'workspace')
    private readonly cases: Repository<CaseEntity>,
    @InjectRepository(AuditLog, 'workspace')
    private readonly auditLogs: Repository<AuditLog>,
    @InjectDataSource('source')
    private readonly source: DataSource,
  ) {}

  async list(query: ListClientsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const qb = this.links
      .createQueryBuilder('cl')
      .leftJoinAndSelect('cl.user', 'user')
      .orderBy('cl.id', 'ASC');

    if (query.verificationStatus) {
      qb.andWhere('cl.verificationStatus = :vs', {
        vs: query.verificationStatus,
      });
    }

    const [rows, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    const sourceIds = rows.map((r) => r.sourceClientId);
    const erpMap = await this.loadSrcClients(sourceIds);

    let data = rows.map((link) => this.mapDirectoryRow(link, erpMap.get(link.sourceClientId)));

    if (query.q?.trim()) {
      const q = query.q.trim().toLowerCase();
      data = data.filter(
        (row) =>
          row.name?.toLowerCase().includes(q) ||
          row.cnic?.toLowerCase().includes(q) ||
          row.email?.toLowerCase().includes(q) ||
          row.mobile?.toLowerCase().includes(q) ||
          row.reference.toLowerCase().includes(q),
      );
    }

    return {
      data,
      meta: {
        page,
        pageSize,
        total: query.q?.trim() ? data.length : total,
        totalPages: Math.ceil(
          (query.q?.trim() ? data.length : total) / pageSize,
        ),
      },
    };
  }

  async listVerifications(query: ListClientsQueryDto) {
    return this.list({
      ...query,
      verificationStatus: query.verificationStatus ?? 'pending',
    });
  }

  async findOne(id: string) {
    const link = await this.links.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!link) {
      throw new NotFoundException(`Client link ${id} not found`);
    }

    const erp = (
      await this.loadSrcClients([link.sourceClientId])
    ).get(link.sourceClientId);

    const sales = await this.source.query(
      `SELECT source_unitsale_id, source_client_id, client_name, cnic, mobile_number, email,
              source_unit_id, unitname, buildingname, projectname, sale_number, booking_date,
              net_price, net_receipts, current_outstanding, sale_status_id
       FROM src_sale_context
       WHERE source_client_id = ?
       ORDER BY booking_date DESC`,
      [link.sourceClientId],
    ) as SrcSaleRow[];

    const relatedCases = await this.cases.find({
      where: { sourceClientId: link.sourceClientId },
      relations: ['category', 'department', 'assignee'],
      order: { openedAt: 'DESC' },
      take: 50,
    });

    return {
      ...this.mapDirectoryRow(link, erp),
      profile: erp
        ? {
            sourceClientId: erp.id,
            name: erp.person,
            email: erp.email,
            mobile: erp.mobile_number,
            workPhone: erp.work_phone,
            cnic: erp.cnic,
            billingAddress: erp.billing_address,
          }
        : null,
      sales: sales.map((s) => ({
        sourceUnitsaleId: s.source_unitsale_id,
        saleNumber: s.sale_number,
        unitName: s.unitname,
        buildingName: s.buildingname,
        projectName: s.projectname,
        bookingDate: s.booking_date,
        netPrice: s.net_price,
        netReceipts: s.net_receipts,
        currentOutstanding: s.current_outstanding,
        saleStatusId: s.sale_status_id,
      })),
      cases: relatedCases.map(mapCase),
    };
  }

  async verify(actor: RequestUser, id: string, dto: VerifyClientDto) {
    const link = await this.links.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!link) {
      throw new NotFoundException(`Client link ${id} not found`);
    }

    if (dto.cnic && !CNIC_REGEX.test(dto.cnic)) {
      throw new UnprocessableEntityException(
        'cnic must match format 35202-XXXXXXX-X',
      );
    }
    if (dto.mobile && !MOBILE_REGEX.test(dto.mobile)) {
      throw new UnprocessableEntityException(
        'mobile must match format 03XX-XXXXXXX',
      );
    }

    // CNIC/mobile on verify are validated for staff-entered corrections;
    // ERP src_clients is read-only — we only store verification outcome on the link.
    const nextStatus = ACTION_TO_STATUS[dto.action];
    link.verificationStatus = nextStatus;
    await this.links.save(link);

    if (link.user) {
      if (dto.action === 'approve' && link.user.status === 'disabled') {
        // leave password flags alone; just ensure not disabled if was
      }
      if (dto.action === 'reject') {
        link.user.status = 'disabled';
        await this.links.manager.save(link.user);
      }
      if (
        (dto.action === 'approve' || dto.action === 'under_review') &&
        link.user.status === 'disabled'
      ) {
        link.user.status = 'active';
        await this.links.manager.save(link.user);
      }
    }

    await this.auditLogs.save(
      this.auditLogs.create({
        userId: actor.id,
        roleCode: actor.roleCode,
        departmentId: actor.departmentId,
        action: `client.verify.${dto.action}`,
        module: 'clients',
        subjectType: 'client_link',
        subjectId: link.id,
        ip: null,
      }),
    );

    return this.findOne(String(link.id));
  }

  private async loadSrcClients(
    ids: number[],
  ): Promise<Map<number, SrcClientRow>> {
    const map = new Map<number, SrcClientRow>();
    if (!ids.length) return map;
    const placeholders = ids.map(() => '?').join(', ');
    const rows = (await this.source.query(
      `SELECT id, person, email, mobile_number, work_phone, cnic, billing_address
       FROM src_clients WHERE id IN (${placeholders})`,
      ids,
    )) as SrcClientRow[];
    for (const row of rows) {
      map.set(Number(row.id), row);
    }
    return map;
  }

  private mapDirectoryRow(link: ClientLink, erp?: SrcClientRow) {
    return {
      id: String(link.id),
      reference: `CL-${String(link.sourceClientId).padStart(5, '0')}`,
      sourceClientId: link.sourceClientId,
      verificationStatus: link.verificationStatus,
      name: erp?.person ?? link.user?.name ?? null,
      email: erp?.email ?? link.user?.email ?? null,
      mobile: erp?.mobile_number ?? link.user?.phone ?? null,
      cnic: erp?.cnic ?? null,
      user: link.user
        ? {
            id: String(link.user.id),
            name: link.user.name,
            email: link.user.email,
            status: link.user.status,
          }
        : null,
      createdAt: link.createdAt,
      updatedAt: link.updatedAt,
    };
  }
}
