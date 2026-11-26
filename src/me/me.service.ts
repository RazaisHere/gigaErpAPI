import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { RequestUser } from '../auth/types/jwt-payload';
import { ClientLink } from '../clients/entities/client-link.entity';
import { ListMeQueryDto } from './dto/list-me.query.dto';
import { resolveApprovedClientLink } from './me.access';

type SrcClientRow = {
  id: number;
  person: string | null;
  email: string | null;
  mobile_number: string | null;
  work_phone: string | null;
  cnic: string | null;
  billing_address: string | null;
};

type SaleRow = {
  source_unitsale_id: number;
  source_client_id: number;
  client_name: string | null;
  cnic: string | null;
  mobile_number: string | null;
  email: string | null;
  source_unit_id: number | null;
  unitname: string | null;
  source_floor_id: number | null;
  floorname: string | null;
  source_building_id: number | null;
  buildingname: string | null;
  source_project_id: number | null;
  projectname: string | null;
  sale_number: string | null;
  booking_date: Date | null;
  net_price: number | null;
  net_receipts: number | null;
  current_outstanding: number | null;
  sale_status_id: number | null;
};

type NextDueRow = {
  id: number;
  unitsale_id: number;
  due_date: Date;
  percentage: number | null;
  amount: number | null;
  unitname: string | null;
  buildingname: string | null;
  projectname: string | null;
  sale_number: string | null;
  source_project_id: number | null;
};

@Injectable()
export class MeService {
  constructor(
    @InjectRepository(ClientLink, 'workspace')
    private readonly links: Repository<ClientLink>,
    @InjectDataSource('source')
    private readonly source: DataSource,
  ) {}

  async profile(actor: RequestUser) {
    const approved = await resolveApprovedClientLink(this.links, actor);
    const erpRows = (await this.source.query(
      `SELECT id, person, email, mobile_number, work_phone, cnic, billing_address
       FROM src_clients WHERE id = ? LIMIT 1`,
      [approved.sourceClientId],
    )) as SrcClientRow[];
    const erp = erpRows[0];

    return {
      user: {
        id: actor.id,
        name: actor.name,
        email: actor.email,
        status: actor.status,
        roleCode: actor.roleCode,
      },
      link: {
        id: approved.linkId,
        sourceClientId: approved.sourceClientId,
        verificationStatus: approved.verificationStatus,
        reference: `CL-${String(approved.sourceClientId).padStart(5, '0')}`,
      },
      erp: erp
        ? {
            sourceClientId: Number(erp.id),
            name: erp.person,
            email: erp.email,
            mobile: erp.mobile_number,
            workPhone: erp.work_phone,
            cnic: erp.cnic,
            billingAddress: erp.billing_address,
          }
        : null,
    };
  }

  async summary(actor: RequestUser) {
    const { sourceClientId } = await resolveApprovedClientLink(
      this.links,
      actor,
    );

    const [totalsRow] = (await this.source.query(
      `SELECT COUNT(*) AS unit_count,
              COUNT(DISTINCT sc.source_project_id) AS project_count,
              COALESCE(SUM(sc.net_price), 0) AS investment,
              COALESCE(SUM(sc.net_receipts), 0) AS paid,
              COALESCE(SUM(sc.current_outstanding), 0) AS outstanding
       FROM src_sale_context sc
       WHERE sc.source_client_id = ?`,
      [sourceClientId],
    )) as Array<{
      unit_count: number;
      project_count: number;
      investment: number;
      paid: number;
      outstanding: number;
    }>;

    const investment = Number(totalsRow?.investment ?? 0);
    const paid = Number(totalsRow?.paid ?? 0);
    const outstanding = Number(totalsRow?.outstanding ?? 0);

    const projects = await this.loadProjectRollups(sourceClientId);
    const nextDue = await this.loadNextDue(sourceClientId);

    return {
      totals: {
        investment,
        paid,
        outstanding,
        paidPercent: this.paidPercent(paid, investment),
        unitCount: Number(totalsRow?.unit_count ?? 0),
        projectCount: Number(totalsRow?.project_count ?? 0),
      },
      nextDue,
      projects,
    };
  }

  async listProjects(actor: RequestUser) {
    const { sourceClientId } = await resolveApprovedClientLink(
      this.links,
      actor,
    );
    const projects = await this.loadProjectRollups(sourceClientId);
    return { data: projects };
  }

  async getProject(actor: RequestUser, sourceProjectIdRaw: string) {
    const { sourceClientId } = await resolveApprovedClientLink(
      this.links,
      actor,
    );
    const sourceProjectId = Number(sourceProjectIdRaw);
    if (!Number.isFinite(sourceProjectId) || sourceProjectId < 1) {
      throw new NotFoundException(`Project ${sourceProjectIdRaw} not found`);
    }

    const rollups = await this.loadProjectRollups(sourceClientId, sourceProjectId);
    const project = rollups[0];
    if (!project) {
      throw new NotFoundException(`Project ${sourceProjectId} not found`);
    }

    const units = (await this.source.query(
      `SELECT sc.source_unitsale_id, sc.source_client_id, sc.client_name, sc.cnic,
              sc.mobile_number, sc.email, sc.source_unit_id, sc.unitname,
              sc.source_floor_id, sc.floorname, sc.source_building_id, sc.buildingname,
              sc.source_project_id, sc.projectname, sc.sale_number, sc.booking_date,
              sc.net_price, sc.net_receipts, sc.current_outstanding, sc.sale_status_id
       FROM src_sale_context sc
       WHERE sc.source_client_id = ? AND sc.source_project_id = ?
       ORDER BY sc.booking_date DESC, sc.source_unitsale_id DESC`,
      [sourceClientId, sourceProjectId],
    )) as SaleRow[];

    const nextDue = await this.loadNextDue(sourceClientId, {
      sourceProjectId,
    });

    return {
      project: { ...project, nextDue },
      units: units.map((u) => this.mapUnitSummary(u)),
    };
  }

  async getUnit(actor: RequestUser, sourceUnitsaleIdRaw: string) {
    const { sourceClientId } = await resolveApprovedClientLink(
      this.links,
      actor,
    );
    const sourceUnitsaleId = Number(sourceUnitsaleIdRaw);
    if (!Number.isFinite(sourceUnitsaleId) || sourceUnitsaleId < 1) {
      throw new NotFoundException(`Unit sale ${sourceUnitsaleIdRaw} not found`);
    }

    const sales = (await this.source.query(
      `SELECT sc.source_unitsale_id, sc.source_client_id, sc.client_name, sc.cnic,
              sc.mobile_number, sc.email, sc.source_unit_id, sc.unitname,
              sc.source_floor_id, sc.floorname, sc.source_building_id, sc.buildingname,
              sc.source_project_id, sc.projectname, sc.sale_number, sc.booking_date,
              sc.net_price, sc.net_receipts, sc.current_outstanding, sc.sale_status_id
       FROM src_sale_context sc
       WHERE sc.source_client_id = ? AND sc.source_unitsale_id = ?
       LIMIT 1`,
      [sourceClientId, sourceUnitsaleId],
    )) as SaleRow[];

    const sale = sales[0];
    if (!sale) {
      throw new NotFoundException(`Unit sale ${sourceUnitsaleId} not found`);
    }

    const netPrice = Number(sale.net_price ?? 0);
    const paid = Number(sale.net_receipts ?? 0);

    const installmentRows = (await this.source.query(
      `SELECT id, unitsale_id, paymenttype_id, due_date, percentage
       FROM src_installments
       WHERE unitsale_id = ?
       ORDER BY due_date ASC, id ASC`,
      [sourceUnitsaleId],
    )) as Array<{
      id: number;
      unitsale_id: number;
      paymenttype_id: number | null;
      due_date: Date | null;
      percentage: number | null;
    }>;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let runningPaidBudget = paid;
    const installments = installmentRows.map((row, index) => {
      const amount =
        Math.round(netPrice * Number(row.percentage ?? 0) / 100 * 100) / 100;
      let status: 'Paid' | 'Pending' | 'Upcoming' | 'Overdue' = 'Pending';
      let paidDate: Date | null = null;

      if (runningPaidBudget >= amount - 0.01) {
        status = 'Paid';
        runningPaidBudget -= amount;
        paidDate = row.due_date;
      } else {
        const due = row.due_date ? new Date(row.due_date) : null;
        if (due) {
          due.setHours(0, 0, 0, 0);
          if (due < today) status = 'Overdue';
          else status = 'Upcoming';
        } else {
          status = 'Pending';
        }
      }

      return {
        id: String(row.id),
        sourceInstallmentId: Number(row.id),
        sequence: index + 1,
        amount,
        percentage: row.percentage != null ? Number(row.percentage) : null,
        dueDate: row.due_date,
        paidDate: status === 'Paid' ? paidDate : null,
        status,
        paymentTypeId:
          row.paymenttype_id != null ? Number(row.paymenttype_id) : null,
      };
    });

    const nextDue = await this.loadNextDue(sourceClientId, {
      sourceUnitsaleId,
    });

    const [receiptAgg] = (await this.source.query(
      `SELECT COUNT(*) AS cnt, COALESCE(SUM(amount_received), 0) AS total
       FROM src_receipts
       WHERE unitsale_id = ? AND (client_id = ? OR client_id IS NULL OR client_id = 0)`,
      [sourceUnitsaleId, sourceClientId],
    )) as Array<{ cnt: number; total: number }>;

    return {
      sale: this.mapUnitSummary(sale),
      nextDue,
      installments,
      receiptsSummary: {
        count: Number(receiptAgg?.cnt ?? 0),
        totalAmount: Number(receiptAgg?.total ?? 0),
      },
    };
  }

  async portfolio(actor: RequestUser, query: ListMeQueryDto) {
    const { sourceClientId } = await resolveApprovedClientLink(
      this.links,
      actor,
    );
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const where: string[] = ['sc.source_client_id = ?'];
    const params: unknown[] = [sourceClientId];
    if (query.sourceProjectId) {
      where.push('sc.source_project_id = ?');
      params.push(query.sourceProjectId);
    }
    if (query.sourceUnitsaleId) {
      where.push('sc.source_unitsale_id = ?');
      params.push(query.sourceUnitsaleId);
    }
    const whereSql = `WHERE ${where.join(' AND ')}`;
    const from = `FROM src_sale_context sc`;

    const countRows = (await this.source.query(
      `SELECT COUNT(*) AS cnt ${from} ${whereSql}`,
      params,
    )) as Array<{ cnt: number }>;
    const total = Number(countRows[0]?.cnt ?? 0);

    const rows = (await this.source.query(
      `SELECT sc.source_unitsale_id, sc.source_client_id, sc.client_name, sc.cnic,
              sc.mobile_number, sc.email, sc.source_unit_id, sc.unitname,
              sc.source_floor_id, sc.floorname, sc.source_building_id, sc.buildingname,
              sc.source_project_id, sc.projectname, sc.sale_number, sc.booking_date,
              sc.net_price, sc.net_receipts, sc.current_outstanding, sc.sale_status_id
       ${from}
       ${whereSql}
       ORDER BY sc.booking_date DESC, sc.source_unitsale_id DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset],
    )) as SaleRow[];

    return {
      data: rows.map((r) => this.mapUnitSummary(r)),
      meta: this.meta(page, pageSize, total),
    };
  }

  async dues(actor: RequestUser, query: ListMeQueryDto) {
    const { sourceClientId } = await resolveApprovedClientLink(
      this.links,
      actor,
    );
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;
    const withinDays = query.withinDays ?? 90;

    const from = `
      FROM src_installments i
      INNER JOIN src_sale_context sc
        ON sc.source_unitsale_id = i.unitsale_id
       AND sc.source_client_id = ?
    `;
    const where: string[] = [
      'i.due_date >= CURDATE()',
      'i.due_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)',
    ];
    const params: unknown[] = [sourceClientId, withinDays];

    if (query.sourceProjectId) {
      where.push('sc.source_project_id = ?');
      params.push(query.sourceProjectId);
    }
    if (query.sourceUnitsaleId) {
      where.push('i.unitsale_id = ?');
      params.push(query.sourceUnitsaleId);
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;

    const countRows = (await this.source.query(
      `SELECT COUNT(*) AS cnt ${from} ${whereSql}`,
      params,
    )) as Array<{ cnt: number }>;
    const total = Number(countRows[0]?.cnt ?? 0);

    const rows = (await this.source.query(
      `SELECT i.id, i.unitsale_id, i.due_date, i.percentage, i.paymenttype_id,
              sc.source_client_id, sc.client_name, sc.cnic, sc.unitname,
              sc.buildingname, sc.projectname, sc.sale_number, sc.net_price,
              sc.current_outstanding, sc.source_project_id,
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
        sourceProjectId:
          r.source_project_id != null ? Number(r.source_project_id) : null,
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
        status: 'Upcoming',
        paymentTypeId:
          r.paymenttype_id != null ? Number(r.paymenttype_id) : null,
      })),
      meta: this.meta(page, pageSize, total),
    };
  }

  async receipts(actor: RequestUser, query: ListMeQueryDto) {
    const { sourceClientId } = await resolveApprovedClientLink(
      this.links,
      actor,
    );
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const from = `
      FROM src_receipts r
      INNER JOIN src_sale_context sc
        ON sc.source_unitsale_id = r.unitsale_id
       AND sc.source_client_id = ?
    `;
    const where: string[] = ['1=1'];
    const params: unknown[] = [sourceClientId];

    if (query.sourceProjectId) {
      where.push('sc.source_project_id = ?');
      params.push(query.sourceProjectId);
    }
    if (query.sourceUnitsaleId) {
      where.push('r.unitsale_id = ?');
      params.push(query.sourceUnitsaleId);
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;

    const countRows = (await this.source.query(
      `SELECT COUNT(DISTINCT r.id) AS cnt ${from} ${whereSql}`,
      params,
    )) as Array<{ cnt: number }>;
    const total = Number(countRows[0]?.cnt ?? 0);

    const rows = (await this.source.query(
      `SELECT DISTINCT r.id, r.unitsale_id, r.client_id, r.number, r.payment_date,
              r.amount_received, r.paymentmode_id, r.paymenttype_id, r.status_id,
              r.chq_no, sc.client_name, sc.unitname, sc.buildingname,
              sc.projectname, sc.sale_number, sc.source_project_id
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
        sourceClientId: r.client_id != null ? Number(r.client_id) : null,
        sourceProjectId:
          r.source_project_id != null ? Number(r.source_project_id) : null,
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

  async surcharges(actor: RequestUser, query: ListMeQueryDto) {
    const { sourceClientId } = await resolveApprovedClientLink(
      this.links,
      actor,
    );
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const from = `
      FROM src_surcharges s
      INNER JOIN src_sale_context sc
        ON sc.source_unitsale_id = s.unitsale_id
       AND sc.source_client_id = ?
    `;
    const where: string[] = ['1=1'];
    const params: unknown[] = [sourceClientId];

    if (query.sourceProjectId) {
      where.push('sc.source_project_id = ?');
      params.push(query.sourceProjectId);
    }
    if (query.sourceUnitsaleId) {
      where.push('s.unitsale_id = ?');
      params.push(query.sourceUnitsaleId);
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;

    const countRows = (await this.source.query(
      `SELECT COUNT(*) AS cnt ${from} ${whereSql}`,
      params,
    )) as Array<{ cnt: number }>;
    const total = Number(countRows[0]?.cnt ?? 0);

    const rows = (await this.source.query(
      `SELECT s.id, s.unitsale_id, s.outstanding, s.charges, s.payable_date,
              s.charge_date, s.days, sc.source_client_id, sc.client_name,
              sc.unitname, sc.buildingname, sc.projectname, sc.sale_number,
              sc.source_project_id
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
        sourceProjectId:
          r.source_project_id != null ? Number(r.source_project_id) : null,
        clientName: r.client_name ?? null,
        unitName: r.unitname ?? null,
        buildingName: r.buildingname ?? null,
        projectName: r.projectname ?? null,
        saleNumber: r.sale_number ?? null,
        outstanding: r.outstanding != null ? Number(r.outstanding) : null,
        charges: r.charges != null ? Number(r.charges) : null,
        payableDate: r.payable_date ?? null,
        chargeDate: r.charge_date ?? null,
        days: r.days != null ? Number(r.days) : null,
        status: 'Applied',
      })),
      meta: this.meta(page, pageSize, total),
    };
  }

  private async loadProjectRollups(
    sourceClientId: number,
    sourceProjectId?: number,
  ) {
    const where = ['sc.source_client_id = ?'];
    const params: unknown[] = [sourceClientId];
    if (sourceProjectId != null) {
      where.push('sc.source_project_id = ?');
      params.push(sourceProjectId);
    }

    const rows = (await this.source.query(
      `SELECT sc.source_project_id AS source_project_id,
              MAX(sc.projectname) AS project_name,
              COUNT(*) AS unit_count,
              COALESCE(SUM(sc.net_price), 0) AS investment,
              COALESCE(SUM(sc.net_receipts), 0) AS paid,
              COALESCE(SUM(sc.current_outstanding), 0) AS outstanding
       FROM src_sale_context sc
       WHERE ${where.join(' AND ')}
       GROUP BY sc.source_project_id
       ORDER BY investment DESC, sc.source_project_id ASC`,
      params,
    )) as Array<{
      source_project_id: number;
      project_name: string | null;
      unit_count: number;
      investment: number;
      paid: number;
      outstanding: number;
    }>;

    return rows.map((r) => {
      const investment = Number(r.investment ?? 0);
      const paid = Number(r.paid ?? 0);
      return {
        sourceProjectId: Number(r.source_project_id),
        projectName: r.project_name,
        unitCount: Number(r.unit_count ?? 0),
        investment,
        paid,
        outstanding: Number(r.outstanding ?? 0),
        paidPercent: this.paidPercent(paid, investment),
      };
    });
  }

  private async loadNextDue(
    sourceClientId: number,
    opts?: { sourceProjectId?: number; sourceUnitsaleId?: number },
  ) {
    const where: string[] = [
      'sc.source_client_id = ?',
      'i.due_date >= CURDATE()',
    ];
    const params: unknown[] = [sourceClientId];
    if (opts?.sourceProjectId) {
      where.push('sc.source_project_id = ?');
      params.push(opts.sourceProjectId);
    }
    if (opts?.sourceUnitsaleId) {
      where.push('i.unitsale_id = ?');
      params.push(opts.sourceUnitsaleId);
    }

    const rows = (await this.source.query(
      `SELECT i.id, i.unitsale_id, i.due_date, i.percentage,
              ROUND(COALESCE(sc.net_price, 0) * COALESCE(i.percentage, 0) / 100, 2) AS amount,
              sc.unitname, sc.buildingname, sc.projectname, sc.sale_number,
              sc.source_project_id
       FROM src_installments i
       INNER JOIN src_sale_context sc
         ON sc.source_unitsale_id = i.unitsale_id
       WHERE ${where.join(' AND ')}
       ORDER BY i.due_date ASC, i.id ASC
       LIMIT 1`,
      params,
    )) as NextDueRow[];

    const row = rows[0];
    if (!row) return null;

    return {
      sourceInstallmentId: Number(row.id),
      sourceUnitsaleId: Number(row.unitsale_id),
      saleNumber: row.sale_number ?? null,
      unitName: row.unitname ?? null,
      buildingName: row.buildingname ?? null,
      sourceProjectId:
        row.source_project_id != null ? Number(row.source_project_id) : null,
      projectName: row.projectname ?? null,
      amount: row.amount != null ? Number(row.amount) : null,
      dueDate: row.due_date,
      percentage: row.percentage != null ? Number(row.percentage) : null,
    };
  }

  private mapUnitSummary(r: SaleRow) {
    const netPrice = Number(r.net_price ?? 0);
    const netReceipts = Number(r.net_receipts ?? 0);
    return {
      id: String(r.source_unitsale_id),
      sourceUnitsaleId: Number(r.source_unitsale_id),
      saleNumber: r.sale_number ?? null,
      bookingDate: r.booking_date ?? null,
      netPrice: r.net_price != null ? Number(r.net_price) : null,
      netReceipts: r.net_receipts != null ? Number(r.net_receipts) : null,
      currentOutstanding:
        r.current_outstanding != null ? Number(r.current_outstanding) : null,
      paidPercent: this.paidPercent(netReceipts, netPrice),
      saleStatusId: r.sale_status_id != null ? Number(r.sale_status_id) : null,
      sourceClientId: Number(r.source_client_id),
      clientName: r.client_name ?? null,
      cnic: r.cnic ?? null,
      mobile: r.mobile_number ?? null,
      email: r.email ?? null,
      sourceUnitId: r.source_unit_id != null ? Number(r.source_unit_id) : null,
      unitName: r.unitname ?? null,
      buildingName: r.buildingname ?? null,
      sourceBuildingId:
        r.source_building_id != null ? Number(r.source_building_id) : null,
      projectName: r.projectname ?? null,
      sourceProjectId:
        r.source_project_id != null ? Number(r.source_project_id) : null,
    };
  }

  private paidPercent(paid: number, investment: number) {
    if (!investment || investment <= 0) return 0;
    return Math.round((paid / investment) * 1000) / 10;
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
