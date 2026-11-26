import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { RequestUser } from '../auth/types/jwt-payload';
import { CaseEntity } from '../cases/entities/case.entity';
import { Department } from '../users/entities/department.entity';
import {
  CLOSED_CASE_STATUSES,
  OPEN_CASE_STATUSES,
  assertCollectionsReportAccess,
  departmentScopeId,
} from '../reporting/reporting.scope';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(CaseEntity, 'workspace')
    private readonly cases: Repository<CaseEntity>,
    @InjectRepository(Department, 'workspace')
    private readonly departments: Repository<Department>,
    @InjectDataSource('source')
    private readonly source: DataSource,
  ) {}

  async casesReport(actor: RequestUser) {
    const deptId = departmentScopeId(actor);
    const qb = this.cases.createQueryBuilder('c');
    if (deptId) {
      qb.andWhere('c.department_id = :deptId', { deptId });
    }

    const [byStatus, byPriority, bySla, byDepartment] = await Promise.all([
      qb
        .clone()
        .select('c.status', 'key')
        .addSelect('COUNT(*)', 'count')
        .groupBy('c.status')
        .orderBy('count', 'DESC')
        .getRawMany<{ key: string; count: string }>(),
      qb
        .clone()
        .select('c.priority', 'key')
        .addSelect('COUNT(*)', 'count')
        .groupBy('c.priority')
        .orderBy('count', 'DESC')
        .getRawMany<{ key: string; count: string }>(),
      qb
        .clone()
        .select('c.sla_band', 'key')
        .addSelect('COUNT(*)', 'count')
        .groupBy('c.sla_band')
        .orderBy('count', 'DESC')
        .getRawMany<{ key: string; count: string }>(),
      qb
        .clone()
        .leftJoin('c.department', 'd')
        .select('d.id', 'departmentId')
        .addSelect('d.code', 'departmentCode')
        .addSelect('d.name', 'departmentName')
        .addSelect('COUNT(*)', 'count')
        .groupBy('d.id')
        .addGroupBy('d.code')
        .addGroupBy('d.name')
        .orderBy('count', 'DESC')
        .getRawMany<{
          departmentId: string;
          departmentCode: string;
          departmentName: string;
          count: string;
        }>(),
    ]);

    const total = byStatus.reduce((s, r) => s + Number(r.count), 0);

    return {
      scope: deptId
        ? { departmentId: deptId, departmentCode: actor.departmentCode }
        : { departmentId: null, departmentCode: null },
      total,
      byStatus: byStatus.map((r) => ({
        status: r.key,
        count: Number(r.count),
      })),
      byPriority: byPriority.map((r) => ({
        priority: r.key,
        count: Number(r.count),
      })),
      bySlaBand: bySla.map((r) => ({
        slaBand: r.key,
        count: Number(r.count),
      })),
      byDepartment: byDepartment.map((r) => ({
        departmentId: String(r.departmentId),
        departmentCode: r.departmentCode,
        departmentName: r.departmentName,
        count: Number(r.count),
      })),
    };
  }

  async departmentPerformance(actor: RequestUser) {
    const scopeDeptId = departmentScopeId(actor);
    const departments = await this.departments.find({
      where: scopeDeptId ? { id: scopeDeptId } : undefined,
      order: { id: 'ASC' },
    });

    const rows = [];
    for (const d of departments) {
      const base = this.cases
        .createQueryBuilder('c')
        .where('c.department_id = :deptId', { deptId: d.id });

      const [open, closed, breached, avgHoursRaw] = await Promise.all([
        base
          .clone()
          .andWhere('c.status IN (:...open)', { open: OPEN_CASE_STATUSES })
          .getCount(),
        base
          .clone()
          .andWhere('c.status IN (:...closed)', { closed: CLOSED_CASE_STATUSES })
          .getCount(),
        base
          .clone()
          .andWhere('c.sla_band = :b', { b: 'Breached' })
          .andWhere('c.status IN (:...open)', { open: OPEN_CASE_STATUSES })
          .getCount(),
        base
          .clone()
          .select(
            `AVG(EXTRACT(EPOCH FROM (COALESCE(c.closed_at, NOW()) - c.opened_at)) / 3600.0)`,
            'avgHours',
          )
          .getRawOne<{ avgHours: string | null }>(),
      ]);

      rows.push({
        departmentId: String(d.id),
        departmentCode: d.code,
        departmentName: d.name,
        openCases: open,
        closedOrResolved: closed,
        overdueSla: breached,
        avgCaseAgeHours:
          avgHoursRaw?.avgHours != null
            ? Math.round(Number(avgHoursRaw.avgHours) * 10) / 10
            : null,
      });
    }

    return { data: rows };
  }

  async collectionsSummary(actor: RequestUser) {
    assertCollectionsReportAccess(actor);

    const [outstanding, upcoming, receipts, surcharges] = await Promise.all([
      this.source.query(
        `SELECT COUNT(*) AS cnt, COALESCE(SUM(sc.current_outstanding), 0) AS total
         FROM src_sale_context sc
         INNER JOIN (
           SELECT source_unitsale_id, MIN(source_client_id) AS source_client_id
           FROM src_sale_context GROUP BY source_unitsale_id
         ) pick
           ON pick.source_unitsale_id = sc.source_unitsale_id
          AND pick.source_client_id = sc.source_client_id
         WHERE sc.current_outstanding > 0`,
      ) as Promise<Array<{ cnt: number; total: number }>>,
      this.source.query(
        `SELECT COUNT(*) AS cnt,
                COALESCE(SUM(ROUND(COALESCE(sc.net_price,0) * COALESCE(i.percentage,0) / 100, 2)), 0) AS total
         FROM src_installments i
         INNER JOIN (
           SELECT source_unitsale_id, MIN(source_client_id) AS source_client_id
           FROM src_sale_context GROUP BY source_unitsale_id
         ) pick ON pick.source_unitsale_id = i.unitsale_id
         INNER JOIN src_sale_context sc
           ON sc.source_unitsale_id = pick.source_unitsale_id
          AND sc.source_client_id = pick.source_client_id
         WHERE i.due_date >= CURDATE()
           AND i.due_date <= DATE_ADD(CURDATE(), INTERVAL 90 DAY)`,
      ) as Promise<Array<{ cnt: number; total: number }>>,
      this.source.query(
        `SELECT COUNT(*) AS cnt, COALESCE(SUM(amount_received), 0) AS total
         FROM src_receipts
         WHERE payment_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`,
      ) as Promise<Array<{ cnt: number; total: number }>>,
      this.source.query(
        `SELECT COUNT(*) AS cnt, COALESCE(SUM(charges), 0) AS total
         FROM src_surcharges`,
      ) as Promise<Array<{ cnt: number; total: number }>>,
    ]);

    return {
      outstanding: {
        salesCount: Number(outstanding[0]?.cnt ?? 0),
        totalAmount: Number(outstanding[0]?.total ?? 0),
      },
      upcomingDues90Days: {
        installmentCount: Number(upcoming[0]?.cnt ?? 0),
        estimatedAmount: Number(upcoming[0]?.total ?? 0),
      },
      receiptsLast30Days: {
        count: Number(receipts[0]?.cnt ?? 0),
        totalAmount: Number(receipts[0]?.total ?? 0),
      },
      surcharges: {
        count: Number(surcharges[0]?.cnt ?? 0),
        totalCharges: Number(surcharges[0]?.total ?? 0),
      },
    };
  }
}
