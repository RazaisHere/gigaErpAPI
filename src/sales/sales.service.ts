import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CaseEntity } from '../cases/entities/case.entity';
import { mapCase } from '../cases/cases.mapper';
import { ListSalesQueryDto } from './dto/list-sales.query.dto';

type SaleContextRow = {
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

@Injectable()
export class SalesService {
  constructor(
    @InjectDataSource('source')
    private readonly source: DataSource,
    @InjectRepository(CaseEntity, 'workspace')
    private readonly cases: Repository<CaseEntity>,
  ) {}

  async list(query: ListSalesQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const where: string[] = [];
    const params: unknown[] = [];

    // One row per sale (lowest client_id as representative owner)
    const from = `
      FROM src_sale_context sc
      INNER JOIN (
        SELECT source_unitsale_id, MIN(source_client_id) AS source_client_id
        FROM src_sale_context
        GROUP BY source_unitsale_id
      ) pick
        ON pick.source_unitsale_id = sc.source_unitsale_id
       AND pick.source_client_id = sc.source_client_id
    `;

    if (query.sourceClientId) {
      where.push('sc.source_client_id = ?');
      params.push(query.sourceClientId);
    }
    if (query.sourceProjectId) {
      where.push('sc.source_project_id = ?');
      params.push(query.sourceProjectId);
    }
    if (query.saleStatusId != null) {
      where.push('sc.sale_status_id = ?');
      params.push(query.saleStatusId);
    }
    if (query.q?.trim()) {
      const q = `%${query.q.trim()}%`;
      where.push(
        `(sc.sale_number LIKE ? OR sc.client_name LIKE ? OR sc.cnic LIKE ?
          OR sc.unitname LIKE ? OR sc.buildingname LIKE ? OR sc.projectname LIKE ?)`,
      );
      params.push(q, q, q, q, q, q);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

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
    )) as SaleContextRow[];

    return {
      data: rows.map((r) => this.mapSaleSummary(r)),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async findOne(id: string) {
    const saleId = Number(id);
    if (!Number.isFinite(saleId) || saleId < 1) {
      throw new NotFoundException(`Sale ${id} not found`);
    }

    const owners = (await this.source.query(
      `SELECT source_unitsale_id, source_client_id, client_name, cnic, mobile_number, email,
              source_unit_id, unitname, source_floor_id, floorname, source_building_id, buildingname,
              source_project_id, projectname, sale_number, booking_date,
              net_price, net_receipts, current_outstanding, sale_status_id
       FROM src_sale_context
       WHERE source_unitsale_id = ?
       ORDER BY source_client_id ASC`,
      [saleId],
    )) as SaleContextRow[];

    if (!owners.length) {
      throw new NotFoundException(`Sale ${id} not found`);
    }

    const primary = owners[0];

    const [installments, receipts, surcharges] = await Promise.all([
      this.source.query(
        `SELECT id, unitsale_id, paymenttype_id, due_date, percentage
         FROM src_installments WHERE unitsale_id = ? ORDER BY due_date ASC`,
        [saleId],
      ) as Promise<
        Array<{
          id: number;
          unitsale_id: number;
          paymenttype_id: number | null;
          due_date: Date | null;
          percentage: number | null;
        }>
      >,
      this.source.query(
        `SELECT id, unitsale_id, client_id, number, payment_date, amount_received,
                paymentmode_id, paymenttype_id, status_id
         FROM src_receipts WHERE unitsale_id = ? ORDER BY payment_date DESC`,
        [saleId],
      ) as Promise<
        Array<{
          id: number;
          unitsale_id: number;
          client_id: number | null;
          number: string | null;
          payment_date: Date | null;
          amount_received: number | null;
          paymentmode_id: number | null;
          paymenttype_id: number | null;
          status_id: number | null;
        }>
      >,
      this.source.query(
        `SELECT id, unitsale_id, outstanding, charges, payable_date, charge_date, days
         FROM src_surcharges WHERE unitsale_id = ? ORDER BY charge_date DESC`,
        [saleId],
      ) as Promise<
        Array<{
          id: number;
          unitsale_id: number;
          outstanding: number | null;
          charges: number | null;
          payable_date: Date | null;
          charge_date: Date | null;
          days: number | null;
        }>
      >,
    ]);

    const relatedCases = await this.cases.find({
      where: { sourceUnitsaleId: saleId },
      relations: ['category', 'department', 'assignee'],
      order: { openedAt: 'DESC' },
      take: 50,
    });

    return {
      ...this.mapSaleSummary(primary),
      owners: owners.map((o) => ({
        sourceClientId: o.source_client_id,
        name: o.client_name,
        cnic: o.cnic,
        mobile: o.mobile_number,
        email: o.email,
      })),
      unit: {
        sourceUnitId: primary.source_unit_id,
        unitName: primary.unitname,
        floorName: primary.floorname,
        sourceFloorId: primary.source_floor_id,
        buildingName: primary.buildingname,
        sourceBuildingId: primary.source_building_id,
        projectName: primary.projectname,
        sourceProjectId: primary.source_project_id,
      },
      installments: installments.map((i) => ({
        id: i.id,
        paymentTypeId: i.paymenttype_id,
        dueDate: i.due_date,
        percentage: i.percentage,
      })),
      receipts: receipts.map((r) => ({
        id: r.id,
        sourceClientId: r.client_id,
        number: r.number,
        paymentDate: r.payment_date,
        amountReceived: r.amount_received,
        paymentModeId: r.paymentmode_id,
        paymentTypeId: r.paymenttype_id,
        statusId: r.status_id,
      })),
      surcharges: surcharges.map((s) => ({
        id: s.id,
        outstanding: s.outstanding,
        charges: s.charges,
        payableDate: s.payable_date,
        chargeDate: s.charge_date,
        days: s.days,
      })),
      relatedCases: relatedCases.map(mapCase),
    };
  }

  private mapSaleSummary(r: SaleContextRow) {
    return {
      id: String(r.source_unitsale_id),
      sourceUnitsaleId: r.source_unitsale_id,
      saleNumber: r.sale_number,
      bookingDate: r.booking_date,
      netPrice: r.net_price,
      netReceipts: r.net_receipts,
      currentOutstanding: r.current_outstanding,
      saleStatusId: r.sale_status_id,
      sourceClientId: r.source_client_id,
      clientName: r.client_name,
      cnic: r.cnic,
      mobile: r.mobile_number,
      email: r.email,
      sourceUnitId: r.source_unit_id,
      unitName: r.unitname,
      buildingName: r.buildingname,
      sourceBuildingId: r.source_building_id,
      projectName: r.projectname,
      sourceProjectId: r.source_project_id,
    };
  }
}
