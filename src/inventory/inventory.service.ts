import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ListInventoryQueryDto } from './dto/list-inventory.query.dto';

type InventoryRow = {
  id: number;
  unitname: string | null;
  area: number | null;
  gross_area: number | null;
  price: number | null;
  active: number | null;
  building_id: number;
  buildingname: string | null;
  project_id: number;
  projectname: string | null;
  unittype: string | null;
  floorname: string | null;
  inventory_status: 'Available' | 'Sold';
};

@Injectable()
export class InventoryService {
  constructor(
    @InjectDataSource('source')
    private readonly source: DataSource,
  ) {}

  async list(query: ListInventoryQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const where: string[] = ['u.active = 1'];
    const params: unknown[] = [];

    if (query.sourceProjectId) {
      where.push('p.id = ?');
      params.push(query.sourceProjectId);
    }
    if (query.sourceBuildingId) {
      where.push('b.id = ?');
      params.push(query.sourceBuildingId);
    }
    if (query.status === 'Sold') {
      where.push('sold.unit_id IS NOT NULL');
    } else if (query.status === 'Available') {
      where.push('sold.unit_id IS NULL');
    }
    if (query.q?.trim()) {
      const q = `%${query.q.trim()}%`;
      where.push(
        `(u.unitname LIKE ? OR b.buildingname LIKE ? OR p.projectname LIKE ? OR ut.unittype LIKE ?)`,
      );
      params.push(q, q, q, q);
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;
    const from = `
      FROM src_units u
      JOIN src_buildings b ON b.id = u.building_id
      JOIN src_projects p ON p.id = b.project_id
      LEFT JOIN src_unittypes ut ON ut.id = u.unittype_id
      LEFT JOIN src_floors f ON f.id = u.floor_id
      LEFT JOIN (
        SELECT DISTINCT unit_id FROM src_unitsales WHERE active = 1
      ) sold ON sold.unit_id = u.id
    `;

    const countRows = (await this.source.query(
      `SELECT COUNT(*) AS cnt ${from} ${whereSql}`,
      params,
    )) as Array<{ cnt: number }>;
    const total = Number(countRows[0]?.cnt ?? 0);

    const rows = (await this.source.query(
      `SELECT u.id, u.unitname, u.area, u.gross_area, u.price, u.active,
              b.id AS building_id, b.buildingname,
              p.id AS project_id, p.projectname,
              ut.unittype, f.floorname,
              CASE WHEN sold.unit_id IS NULL THEN 'Available' ELSE 'Sold' END AS inventory_status
       ${from}
       ${whereSql}
       ORDER BY p.projectname ASC, b.buildingname ASC, u.unitname ASC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset],
    )) as InventoryRow[];

    return {
      data: rows.map((r) => ({
        id: String(r.id),
        sourceUnitId: r.id,
        unitName: r.unitname,
        unitType: r.unittype,
        floorName: r.floorname,
        area: r.area,
        grossArea: r.gross_area,
        price: r.price,
        status: r.inventory_status,
        sourceBuildingId: r.building_id,
        buildingName: r.buildingname,
        sourceProjectId: r.project_id,
        projectName: r.projectname,
      })),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }
}
