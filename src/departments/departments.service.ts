import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Department } from '../users/entities/department.entity';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Injectable()
export class DepartmentsService {
  constructor(
    @InjectRepository(Department, 'workspace')
    private readonly departments: Repository<Department>,
  ) {}

  async findAll() {
    const rows = await this.departments
      .createQueryBuilder('d')
      .loadRelationCountAndMap('d.memberCount', 'd.departmentUsers')
      .orderBy('d.id', 'ASC')
      .getMany();

    return rows.map((d) => this.toResponse(d));
  }

  async findOne(id: string) {
    const department = await this.departments.findOne({ where: { id } });
    if (!department) {
      throw new NotFoundException(`Department ${id} not found`);
    }
    return this.toResponse(department);
  }

  async create(dto: CreateDepartmentDto) {
    const existing = await this.departments.findOne({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException(`Department code ${dto.code} already exists`);
    }

    const saved = await this.departments.save(
      this.departments.create({
        name: dto.name,
        code: dto.code,
        status: 'active',
      }),
    );
    return this.toResponse(saved);
  }

  async update(id: string, dto: UpdateDepartmentDto) {
    const department = await this.departments.findOne({ where: { id } });
    if (!department) {
      throw new NotFoundException(`Department ${id} not found`);
    }
    if (dto.name !== undefined) department.name = dto.name;
    if (dto.status !== undefined) department.status = dto.status;
    const saved = await this.departments.save(department);
    return this.toResponse(saved);
  }

  private toResponse(d: Department & { memberCount?: number }) {
    return {
      id: String(d.id),
      name: d.name,
      code: d.code,
      status: d.status,
      memberCount:
        typeof d.memberCount === 'number' ? d.memberCount : undefined,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    };
  }
}
