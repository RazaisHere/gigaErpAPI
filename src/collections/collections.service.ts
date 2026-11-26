import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { RequestUser } from '../auth/types/jwt-payload';
import { CasesService } from '../cases/cases.service';
import { CaseCategory } from '../cases/entities/case-category.entity';
import { assertCollectionsAccess } from './collections.access';
import { CreateRecoveryCaseDto } from './dto/create-recovery-case.dto';
import { ListCollectionsQueryDto } from './dto/list-collections.query.dto';

const SALE_PICK_JOIN = `
  FROM src_sale_context sc
  INNER JOIN (
    SELECT source_unitsale_id, MIN(source_client_id) AS source_client_id
    FROM src_sale_context
    GROUP BY source_unitsale_id
  ) pick
    ON pick.source_unitsale_id = sc.source_unitsale_id
   AND pick.source_client_id = sc.source_client_id
`;

@Injectable()
export class CollectionsService {
  constructor(
    @InjectDataSource('source')
    private readonly source: DataSource,
    @InjectRepository(CaseCategory, 'workspace')
    private readonly categories: Repository<CaseCategory>,
    private readonly cases: CasesService,
  ) {}

  async listOutstanding(actor: RequestUser, query: ListCollectionsQueryDto) {
    assertCollectionsAccess(actor);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const where: string[] = ['sc.current_outstanding > 0'];
    const params: unknown[] = [];
    this.applyCommonFilters(where, params, query, 'sc');

    const whereSql = `WHERE ${where.join(' AND ')}`;

    const countRows = (await this.source.query(
      `SELECT COUNT(*) AS cnt ${SALE_PICK_JOIN} ${whereSql}`,
      params,
    )) as Array<{ cnt: number }>;
    const total = Number(countRows[0]?.cnt ?? 0);

    const rows = (await this.source.query(
      `SELECT sc.source_unitsale_id, sc.source_client_id, sc.client_name, sc.cnic,
              sc.mobile_number, sc.email, sc.source_unit_id, sc.unitname,
              sc.buildingname, sc.source_project_id, sc.projectname, sc.sale_number,
              sc.booking_date, sc.net_price, sc.net_receipts, sc.current_outstanding,
              sc.sale_status_id,
              (SELECT MIN(i.due_date) FROM src_installments i
                WHERE i.unitsale_id = sc.source_unitsale_id
                  AND i.due_date >= CURDATE()) AS next_due_date,
              (SELECT MIN(i.due_date) FROM src_installments i
                WHERE i.unitsale_id = sc.source_unitsale_id
                  AND i.due_date < CURDATE()) AS oldest_overdue_due,
              DATEDIFF(
                CURDATE(),
                (SELECT MIN(i.due_date) FROM src_installments i
                  WHERE i.unitsale_id = sc.source_unitsale_id
                    AND i.due_date < CURDATE())
              ) AS days_overdue
       ${SALE_PICK_JOIN}
       ${whereSql}
       ORDER BY sc.current_outstanding DESC, sc.source_unitsale_id DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset],
    )) as Array<Record<string, unknown>>;

    return {
      data: rows.map((r) => ({
        id: String(r.source_unitsale_id),
        sourceUnitsaleId: Number(r.source_unitsale_id),
        sourceClientId: Number(r.source_client_id),
        reference: r.sale_number
          ? String(r.sale_number)
          : `US-${r.source_unitsale_id}`,
        clientName: r.client_name ?? null,
        cnic: r.cnic ?? null,
        mobile: r.mobile_number ?? null,
        email: r.email ?? null,
        sourceUnitId: r.source_unit_id != null ? Number(r.source_unit_id) : null,
        unitName: r.unitname ?? null,
        buildingName: r.buildingname ?? null,
        sourceProjectId:
          r.source_project_id != null ? Number(r.source_project_id) : null,
        projectName: r.projectname ?? null,
        netPrice: r.net_price != null ? Number(r.net_price) : null,
        netReceipts: r.net_receipts != null ? Number(r.net_receipts) : null,
        outstanding: Number(r.current_outstanding),
        nextDueDate: r.next_due_date ?? null,
        daysOverdue:
          r.days_overdue != null ? Number(r.days_overdue) : null,
        status:
          r.days_overdue != null && Number(r.days_overdue) > 0
            ? 'Overdue'
            : 'Outstanding',
        saleStatusId:
          r.sale_status_id != null ? Number(r.sale_status_id) : null,
      })),
      meta: this.meta(page, pageSize, total),
    };
  }

  async listUpcomingDues(actor: RequestUser, query: ListCollectionsQueryDto) {
    assertCollectionsAccess(actor);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;
    const withinDays = query.withinDays ?? 90;

    const where: string[] = [
      'i.due_date >= CURDATE()',
      'i.due_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)',
    ];
    const params: unknown[] = [withinDays];

    if (query.sourceClientId) {
      where.push('sc.source_client_id = ?');
      params.push(query.sourceClientId);
    }
    if (query.sourceProjectId) {
      where.push('sc.source_project_id = ?');
      params.push(query.sourceProjectId);
    }
    if (query.q?.trim()) {
      const q = `%${query.q.trim()}%`;
      where.push(
        `(sc.sale_number LIKE ? OR sc.client_name LIKE ? OR sc.cnic LIKE ?
          OR sc.unitname LIKE ? OR sc.projectname LIKE ?)`,
      );
      params.push(q, q, q, q, q);
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;
    const from = `
      FROM src_installments i
      INNER JOIN (
        SELECT source_unitsale_id, MIN(source_client_id) AS source_client_id
        FROM src_sale_context
        GROUP BY source_unitsale_id
      ) pick ON pick.source_unitsale_id = i.unitsale_id
      INNER JOIN src_sale_context sc
        ON sc.source_unitsale_id = pick.source_unitsale_id
       AND sc.source_client_id = pick.source_client_id
    `;

    const countRows = (await this.source.query(
      `SELECT COUNT(*) AS cnt ${from} ${whereSql}`,
      params,
    )) as Array<{ cnt: number }>;
    const total = Number(countRows[0]?.cnt ?? 0);

    const rows = (await this.source.query(
      `SELECT i.id, i.unitsale_id, i.due_date, i.percentage, i.paymenttype_id,
              sc.source_client_id, sc.client_name, sc.cnic, sc.unitname,
              sc.buildingname, sc.projectname, sc.sale_number, sc.net_price,
              sc.current_outstanding,
              ROUND(COALESCE(sc.net_price, 0) * COALESCE(i.percentage, 0) / 100, 2) AS amount
       ${from}
       ${whereSql}
       ORDER BY i.due_date ASC, i.id ASC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset],
    )) as Array<Record<string, unknown>>;

    return {
      data: rows.map((r) => ({
        id: String(r.id),
        sourceInstallmentId: Number(r.id),
        sourceUnitsaleId: Number(r.unitsale_id),
        sourceClientId: Number(r.source_client_id),
        reference: r.sale_number ? String(r.sale_number) : null,
        clientName: r.client_name ?? null,
        cnic: r.cnic ?? null,
        unitName: r.unitname ?? null,
        buildingName: r.buildingname ?? null,
        projectName: r.projectname ?? null,
        dueDate: r.due_date ?? null,
        percentage: r.percentage != null ? Number(r.percentage) : null,
        amount: r.amount != null ? Number(r.amount) : null,
        outstanding:
          r.current_outstanding != null
            ? Number(r.current_outstanding)
            : null,
        status: 'Scheduled',
        paymentTypeId:
          r.paymenttype_id != null ? Number(r.paymenttype_id) : null,
      })),
      meta: this.meta(page, pageSize, total),
    };
  }

  async listReceipts(actor: RequestUser, query: ListCollectionsQueryDto) {
    assertCollectionsAccess(actor);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const where: string[] = ['1=1'];
    const params: unknown[] = [];

    if (query.sourceClientId) {
      where.push('r.client_id = ?');
      params.push(query.sourceClientId);
    }
    if (query.sourceProjectId) {
      where.push('sc.source_project_id = ?');
      params.push(query.sourceProjectId);
    }
    if (query.q?.trim()) {
      const q = `%${query.q.trim()}%`;
      where.push(
        `(r.number LIKE ? OR sc.client_name LIKE ? OR sc.sale_number LIKE ?
          OR sc.unitname LIKE ? OR sc.projectname LIKE ?)`,
      );
      params.push(q, q, q, q, q);
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;
    const from = `
      FROM src_receipts r
      LEFT JOIN (
        SELECT source_unitsale_id, MIN(source_client_id) AS source_client_id
        FROM src_sale_context
        GROUP BY source_unitsale_id
      ) pick ON pick.source_unitsale_id = r.unitsale_id
      LEFT JOIN src_sale_context sc
        ON sc.source_unitsale_id = pick.source_unitsale_id
       AND sc.source_client_id = pick.source_client_id
    `;

    const countRows = (await this.source.query(
      `SELECT COUNT(*) AS cnt ${from} ${whereSql}`,
      params,
    )) as Array<{ cnt: number }>;
    const total = Number(countRows[0]?.cnt ?? 0);

    const rows = (await this.source.query(
      `SELECT r.id, r.unitsale_id, r.client_id, r.number, r.payment_date,
              r.amount_received, r.paymentmode_id, r.paymenttype_id, r.status_id,
              r.chq_no, sc.client_name, sc.unitname, sc.buildingname,
              sc.projectname, sc.sale_number
       ${from}
       ${whereSql}
       ORDER BY r.payment_date DESC, r.id DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset],
    )) as Array<Record<string, unknown>>;

    return {
      data: rows.map((r) => ({
        id: String(r.id),
        sourceReceiptId: Number(r.id),
        number: r.number ?? null,
        sourceUnitsaleId: Number(r.unitsale_id),
        sourceClientId: Number(r.client_id),
        clientName: r.client_name ?? null,
        unitName: r.unitname ?? null,
        buildingName: r.buildingname ?? null,
        projectName: r.projectname ?? null,
        saleNumber: r.sale_number ?? null,
        amount: Number(r.amount_received),
        paymentDate: r.payment_date ?? null,
        paymentModeId:
          r.paymentmode_id != null ? Number(r.paymentmode_id) : null,
        paymentTypeId:
          r.paymenttype_id != null ? Number(r.paymenttype_id) : null,
        statusId: r.status_id != null ? Number(r.status_id) : null,
        status:
          r.status_id === 1 || r.status_id === '1' ? 'Cleared' : 'Pending',
        chequeNo: r.chq_no ?? null,
      })),
      meta: this.meta(page, pageSize, total),
    };
  }

  async listSurcharges(actor: RequestUser, query: ListCollectionsQueryDto) {
    assertCollectionsAccess(actor);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const where: string[] = ['1=1'];
    const params: unknown[] = [];

    if (query.sourceClientId) {
      where.push('sc.source_client_id = ?');
      params.push(query.sourceClientId);
    }
    if (query.sourceProjectId) {
      where.push('sc.source_project_id = ?');
      params.push(query.sourceProjectId);
    }
    if (query.q?.trim()) {
      const q = `%${query.q.trim()}%`;
      where.push(
        `(sc.client_name LIKE ? OR sc.sale_number LIKE ? OR sc.unitname LIKE ?
          OR sc.projectname LIKE ? OR CAST(s.id AS CHAR) LIKE ?)`,
      );
      params.push(q, q, q, q, q);
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;
    const from = `
      FROM src_surcharges s
      INNER JOIN (
        SELECT source_unitsale_id, MIN(source_client_id) AS source_client_id
        FROM src_sale_context
        GROUP BY source_unitsale_id
      ) pick ON pick.source_unitsale_id = s.unitsale_id
      INNER JOIN src_sale_context sc
        ON sc.source_unitsale_id = pick.source_unitsale_id
       AND sc.source_client_id = pick.source_client_id
    `;

    const countRows = (await this.source.query(
      `SELECT COUNT(*) AS cnt ${from} ${whereSql}`,
      params,
    )) as Array<{ cnt: number }>;
    const total = Number(countRows[0]?.cnt ?? 0);

    const rows = (await this.source.query(
      `SELECT s.id, s.unitsale_id, s.outstanding, s.charges, s.payable_date,
              s.charge_date, s.days, sc.source_client_id, sc.client_name,
              sc.unitname, sc.buildingname, sc.projectname, sc.sale_number
       ${from}
       ${whereSql}
       ORDER BY s.charge_date DESC, s.id DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset],
    )) as Array<Record<string, unknown>>;

    return {
      data: rows.map((r) => ({
        id: String(r.id),
        sourceSurchargeId: Number(r.id),
        sourceUnitsaleId: Number(r.unitsale_id),
        sourceClientId: Number(r.source_client_id),
        clientName: r.client_name ?? null,
        unitName: r.unitname ?? null,
        buildingName: r.buildingname ?? null,
        projectName: r.projectname ?? null,
        saleNumber: r.sale_number ?? null,
        outstanding: Number(r.outstanding),
        charges: r.charges != null ? Number(r.charges) : null,
        payableDate: r.payable_date ?? null,
        chargeDate: r.charge_date ?? null,
        days: r.days != null ? Number(r.days) : null,
        status: 'Applied',
      })),
      meta: this.meta(page, pageSize, total),
    };
  }

  /**
   * Create a workspace recovery case for an outstanding sale (src_unitsale id).
   */
  async createRecoveryCase(
    actor: RequestUser,
    outstandingId: string,
    dto: CreateRecoveryCaseDto,
  ) {
    assertCollectionsAccess(actor);

    const saleId = Number(outstandingId);
    if (!Number.isFinite(saleId) || saleId < 1) {
      throw new NotFoundException(`Outstanding sale ${outstandingId} not found`);
    }

    const rows = (await this.source.query(
      `SELECT sc.source_unitsale_id, sc.source_client_id, sc.source_unit_id,
              sc.client_name, sc.sale_number, sc.unitname, sc.projectname,
              sc.current_outstanding
       ${SALE_PICK_JOIN}
       WHERE sc.source_unitsale_id = ? AND sc.current_outstanding > 0
       LIMIT 1`,
      [saleId],
    )) as Array<Record<string, unknown>>;

    const sale = rows[0];
    if (!sale) {
      throw new NotFoundException(
        `No outstanding balance for sale ${outstandingId}`,
      );
    }

    const category = await this.categories.findOne({
      where: { name: 'Outstanding Query' },
    });
    if (!category) {
      throw new UnprocessableEntityException(
        'Case category "Outstanding Query" is not configured',
      );
    }

    const note =
      dto.note?.trim() ||
      `Recovery case for ${sale.sale_number ?? `sale ${saleId}`} ` +
        `(${sale.client_name ?? 'client'} · ${sale.unitname ?? 'unit'} · ` +
        `${sale.projectname ?? 'project'}) — outstanding PKR ${Number(sale.current_outstanding).toLocaleString()}`;

    return this.cases.create(actor, {
      categoryId: String(category.id),
      sourceClientId: Number(sale.source_client_id),
      sourceUnitsaleId: Number(sale.source_unitsale_id),
      sourceUnitId:
        sale.source_unit_id != null ? Number(sale.source_unit_id) : undefined,
      note,
      priority: 'High',
    });
  }

  private applyCommonFilters(
    where: string[],
    params: unknown[],
    query: ListCollectionsQueryDto,
    alias: string,
  ) {
    if (query.sourceClientId) {
      where.push(`${alias}.source_client_id = ?`);
      params.push(query.sourceClientId);
    }
    if (query.sourceProjectId) {
      where.push(`${alias}.source_project_id = ?`);
      params.push(query.sourceProjectId);
    }
    if (query.q?.trim()) {
      const q = `%${query.q.trim()}%`;
      where.push(
        `(${alias}.sale_number LIKE ? OR ${alias}.client_name LIKE ?
          OR ${alias}.cnic LIKE ? OR ${alias}.unitname LIKE ?
          OR ${alias}.projectname LIKE ?)`,
      );
      params.push(q, q, q, q, q);
    }
  }

  private meta(page: number, pageSize: number, total: number) {
    return {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize) || 1),
    };
  }
}
