import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HandoffRule } from '../departments/entities/handoff-rule.entity';
import { Department } from '../users/entities/department.entity';
import { CreateHandoffRuleDto } from './dto/create-handoff-rule.dto';
import { UpdateHandoffRuleDto } from './dto/update-handoff-rule.dto';

@Injectable()
export class HandoffRulesService {
  constructor(
    @InjectRepository(HandoffRule, 'workspace')
    private readonly rules: Repository<HandoffRule>,
    @InjectRepository(Department, 'workspace')
    private readonly departments: Repository<Department>,
  ) {}

  async findAll() {
    const rows = await this.rules.find({
      order: { id: 'ASC' },
    });
    return rows.map((r) => this.toResponse(r));
  }

  async create(dto: CreateHandoffRuleDto) {
    if (dto.fromDepartmentId === dto.toDepartmentId) {
      throw new BadRequestException('from and to departments must differ');
    }
    const from = await this.requireDepartment(dto.fromDepartmentId);
    const to = await this.requireDepartment(dto.toDepartmentId);

    const existing = await this.rules.findOne({
      where: {
        fromDepartment: { id: from.id },
        toDepartment: { id: to.id },
      },
    });
    if (existing) {
      throw new ConflictException('Handoff rule already exists for this pair');
    }

    const saved = await this.rules.save(
      this.rules.create({
        fromDepartment: from,
        toDepartment: to,
        isAllowed: dto.isAllowed ?? true,
      }),
    );
    return this.toResponse(saved);
  }

  async update(id: string, dto: UpdateHandoffRuleDto) {
    const rule = await this.rules.findOne({ where: { id } });
    if (!rule) {
      throw new NotFoundException(`Handoff rule ${id} not found`);
    }
    rule.isAllowed = dto.isAllowed;
    const saved = await this.rules.save(rule);
    return this.toResponse(saved);
  }

  async remove(id: string) {
    const rule = await this.rules.findOne({ where: { id } });
    if (!rule) {
      throw new NotFoundException(`Handoff rule ${id} not found`);
    }
    await this.rules.remove(rule);
    return { ok: true, removedId: id };
  }

  private async requireDepartment(id: string): Promise<Department> {
    const department = await this.departments.findOne({ where: { id } });
    if (!department) {
      throw new NotFoundException(`Department ${id} not found`);
    }
    return department;
  }

  private toResponse(rule: HandoffRule) {
    return {
      id: String(rule.id),
      isAllowed: Boolean(rule.isAllowed),
      fromDepartment: {
        id: String(rule.fromDepartment.id),
        code: rule.fromDepartment.code,
        name: rule.fromDepartment.name,
      },
      toDepartment: {
        id: String(rule.toDepartment.id),
        code: rule.toDepartment.code,
        name: rule.toDepartment.name,
      },
    };
  }
}
