import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CaseCategory } from '../cases/entities/case-category.entity';
import { Department } from '../users/entities/department.entity';
import { CreateCaseCategoryDto } from './dto/create-case-category.dto';
import { UpdateCaseCategoryDto } from './dto/update-case-category.dto';

@Injectable()
export class CaseCategoriesService {
  constructor(
    @InjectRepository(CaseCategory, 'workspace')
    private readonly categories: Repository<CaseCategory>,
    @InjectRepository(Department, 'workspace')
    private readonly departments: Repository<Department>,
  ) {}

  async findAll() {
    const rows = await this.categories.find({
      order: { id: 'ASC' },
      relations: ['defaultDepartment'],
    });
    return rows.map((c) => this.toResponse(c));
  }

  async findOne(id: string) {
    return this.toResponse(await this.require(id));
  }

  async create(dto: CreateCaseCategoryDto) {
    const existing = await this.categories.findOne({
      where: { name: dto.name.trim() },
    });
    if (existing) {
      throw new ConflictException(`Category "${dto.name}" already exists`);
    }
    const department = await this.requireDepartment(dto.defaultDepartmentId);
    const saved = await this.categories.save(
      this.categories.create({
        name: dto.name.trim(),
        defaultDepartment: department,
        defaultSlaHours: dto.defaultSlaHours ?? 48,
        status: 'active',
      }),
    );
    return this.toResponse(await this.require(String(saved.id)));
  }

  async update(id: string, dto: UpdateCaseCategoryDto) {
    const category = await this.require(id);
    if (dto.name !== undefined) {
      const clash = await this.categories.findOne({
        where: { name: dto.name.trim() },
      });
      if (clash && String(clash.id) !== String(category.id)) {
        throw new ConflictException(`Category "${dto.name}" already exists`);
      }
      category.name = dto.name.trim();
    }
    if (dto.defaultDepartmentId !== undefined) {
      category.defaultDepartment = await this.requireDepartment(
        dto.defaultDepartmentId,
      );
    }
    if (dto.defaultSlaHours !== undefined) {
      category.defaultSlaHours = dto.defaultSlaHours;
    }
    if (dto.status !== undefined) category.status = dto.status;
    await this.categories.save(category);
    return this.toResponse(await this.require(id));
  }

  private async require(id: string) {
    const category = await this.categories.findOne({
      where: { id },
      relations: ['defaultDepartment'],
    });
    if (!category) {
      throw new NotFoundException(`Category ${id} not found`);
    }
    return category;
  }

  private async requireDepartment(id: string) {
    const department = await this.departments.findOne({ where: { id } });
    if (!department) {
      throw new NotFoundException(`Department ${id} not found`);
    }
    return department;
  }

  private toResponse(c: CaseCategory) {
    return {
      id: String(c.id),
      name: c.name,
      defaultDepartment: c.defaultDepartment
        ? {
            id: String(c.defaultDepartment.id),
            name: c.defaultDepartment.name,
            code: c.defaultDepartment.code,
          }
        : null,
      defaultSlaHours: c.defaultSlaHours,
      status: c.status,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  }
}
