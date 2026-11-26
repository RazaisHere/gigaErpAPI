import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { RequestUser } from '../auth/types/jwt-payload';
import { CaseEntity } from '../cases/entities/case.entity';
import { ClientLink } from '../clients/entities/client-link.entity';
import {
  CLOSED_CASE_STATUSES,
  OPEN_CASE_STATUSES,
  assertCollectionsReportAccess,
  departmentScopeId,
} from '../reporting/reporting.scope';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(CaseEntity, 'workspace')
    private readonly cases: Repository<CaseEntity>,
    @InjectRepository(ClientLink, 'workspace')
    private readonly clientLinks: Repository<ClientLink>,
    @InjectDataSource('source')
    private readonly source: DataSource,
  ) {}

  async overview(actor: RequestUser) {
    const deptId = departmentScopeId(actor);

    const base = this.cases.createQueryBuilder('c');
    if (deptId) {
      base.andWhere('c.department_id = :deptId', { deptId });
    }

    const [
      openCases,
      unassigned,
      overdue,
      waitingOnClient,
      closedResolved,
      openedLast14,
      pendingVerifications,
    ] = await Promise.all([
      base
        .clone()
        .andWhere('c.status IN (:...open)', { open: OPEN_CASE_STATUSES })
        .getCount(),
      base
        .clone()
        .andWhere('c.status IN (:...open)', { open: OPEN_CASE_STATUSES })
        .andWhere('c.assignee_user_id IS NULL')
        .getCount(),
      base
        .clone()
        .andWhere('c.sla_band = :breached', { breached: 'Breached' })
        .andWhere('c.status IN (:...open)', { open: OPEN_CASE_STATUSES })
        .getCount(),
      base
        .clone()
        .andWhere('c.status = :w', { w: 'Waiting on Client' })
        .getCount(),
      base
        .clone()
        .andWhere('c.status IN (:...closed)', { closed: CLOSED_CASE_STATUSES })
        .getCount(),
      this.openedPerDay(deptId, 14),
      this.clientLinks.count({ where: { verificationStatus: 'pending' } }),
    ]);

    let collections: {
      outstandingSales: number;
      totalOutstanding: number;
    } | null = null;
    try {
      assertCollectionsReportAccess(actor);
      const rows = (await this.source.query(
        `SELECT COUNT(*) AS cnt, COALESCE(SUM(sc.current_outstanding), 0) AS total
         FROM src_sale_context sc
         INNER JOIN (
           SELECT source_unitsale_id, MIN(source_client_id) AS source_client_id
           FROM src_sale_context
           GROUP BY source_unitsale_id
         ) pick
           ON pick.source_unitsale_id = sc.source_unitsale_id
          AND pick.source_client_id = sc.source_client_id
         WHERE sc.current_outstanding > 0`,
      )) as Array<{ cnt: number; total: number }>;
      collections = {
        outstandingSales: Number(rows[0]?.cnt ?? 0),
        totalOutstanding: Number(rows[0]?.total ?? 0),
      };
    } catch {
      collections = null;
    }

    return {
      scope: deptId
        ? { departmentId: deptId, departmentCode: actor.departmentCode }
        : { departmentId: null, departmentCode: null },
      kpis: {
        openCases,
        unassigned,
        overdueSla: overdue,
        waitingOnClient,
        closedOrResolved: closedResolved,
        pendingClientVerifications: pendingVerifications,
        collections,
      },
      charts: {
        casesOpenedLast14Days: openedLast14,
      },
    };
  }

  private async openedPerDay(deptId: string | null, days: number) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const qb = this.cases
      .createQueryBuilder('c')
      .select(`TO_CHAR(c.opened_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')`, 'day')
      .addSelect('COUNT(*)', 'count')
      .where('c.opened_at >= :since', { since })
      .groupBy('day')
      .orderBy('day', 'ASC');
    if (deptId) {
      qb.andWhere('c.department_id = :deptId', { deptId });
    }
    const rows = await qb.getRawMany<{ day: string; count: string }>();
    const map = new Map(rows.map((r) => [r.day, Number(r.count)]));
    const series: Array<{ date: string; count: number }> = [];
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
      );
      d.setUTCDate(d.getUTCDate() - i);
      const key = d.toISOString().slice(0, 10);
      series.push({ date: key, count: map.get(key) ?? 0 });
    }
    return series;
  }
}
