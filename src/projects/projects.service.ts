import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

type ProjectRow = {
  id: number;
  shortname: string | null;
  projectname: string | null;
  area: string | null;
  city_id: number | null;
  active: number | null;
  building_count: number;
  unit_count: number;
  sold_unit_count: number;
};

type BuildingRow = {
  id: number;
  shortname: string | null;
  buildingname: string | null;
  project_id: number;
  active: number | null;
  unit_count: number;
};

@Injectable()
export class ProjectsService {
  constructor(
    @InjectDataSource('source')
    private readonly source: DataSource,
  ) {}

  async list() {
    const rows = (await this.source.query(
      `SELECT p.id, p.shortname, p.projectname, p.area, p.city_id, p.active,
              (SELECT COUNT(*) FROM src_buildings b WHERE b.project_id = p.id) AS building_count,
              (SELECT COUNT(*) FROM src_units u
                 JOIN src_buildings b ON b.id = u.building_id
                WHERE b.project_id = p.id AND u.active = 1) AS unit_count,
              (SELECT COUNT(DISTINCT us.unit_id) FROM src_unitsales us
                 JOIN src_units u ON u.id = us.unit_id
                 JOIN src_buildings b ON b.id = u.building_id
                WHERE b.project_id = p.id AND us.active = 1) AS sold_unit_count
       FROM src_projects p
       ORDER BY p.projectname ASC`,
    )) as ProjectRow[];

    return {
      data: rows.map((r) => this.mapProject(r)),
    };
  }

  async findOne(id: string) {
    const projectId = Number(id);
    if (!Number.isFinite(projectId) || projectId < 1) {
      throw new NotFoundException(`Project ${id} not found`);
    }

    const projects = (await this.source.query(
      `SELECT p.id, p.shortname, p.projectname, p.area, p.city_id, p.active,
              (SELECT COUNT(*) FROM src_buildings b WHERE b.project_id = p.id) AS building_count,
              (SELECT COUNT(*) FROM src_units u
                 JOIN src_buildings b ON b.id = u.building_id
                WHERE b.project_id = p.id AND u.active = 1) AS unit_count,
              (SELECT COUNT(DISTINCT us.unit_id) FROM src_unitsales us
                 JOIN src_units u ON u.id = us.unit_id
                 JOIN src_buildings b ON b.id = u.building_id
                WHERE b.project_id = p.id AND us.active = 1) AS sold_unit_count
       FROM src_projects p
       WHERE p.id = ?
       LIMIT 1`,
      [projectId],
    )) as ProjectRow[];

    const project = projects[0];
    if (!project) {
      throw new NotFoundException(`Project ${id} not found`);
    }

    const buildings = (await this.source.query(
      `SELECT b.id, b.shortname, b.buildingname, b.project_id, b.active,
              (SELECT COUNT(*) FROM src_units u WHERE u.building_id = b.id AND u.active = 1) AS unit_count
       FROM src_buildings b
       WHERE b.project_id = ?
       ORDER BY b.buildingname ASC`,
      [projectId],
    )) as BuildingRow[];

    return {
      ...this.mapProject(project),
      buildings: buildings.map((b) => ({
        id: String(b.id),
        sourceBuildingId: b.id,
        shortName: b.shortname,
        buildingName: b.buildingname,
        active: Boolean(b.active),
        unitCount: Number(b.unit_count),
      })),
    };
  }

  private mapProject(r: ProjectRow) {
    return {
      id: String(r.id),
      sourceProjectId: r.id,
      shortName: r.shortname,
      projectName: r.projectname,
      area: r.area,
      cityId: r.city_id,
      active: Boolean(r.active),
      buildingCount: Number(r.building_count),
      unitCount: Number(r.unit_count),
      soldUnitCount: Number(r.sold_unit_count),
      availableUnitCount: Math.max(
        0,
        Number(r.unit_count) - Number(r.sold_unit_count),
      ),
    };
  }
}
