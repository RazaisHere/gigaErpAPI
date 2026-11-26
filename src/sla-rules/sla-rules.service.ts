import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SlaRule } from '../cases/entities/sla-rule.entity';
import { CreateSlaRuleDto } from './dto/create-sla-rule.dto';
import { UpdateSlaRuleDto } from './dto/update-sla-rule.dto';

@Injectable()
export class SlaRulesService {
  constructor(
    @InjectRepository(SlaRule, 'workspace')
    private readonly rules: Repository<SlaRule>,
  ) {}

  async findAll() {
    const rows = await this.rules.find({ order: { id: 'ASC' } });
    return rows.map((r) => this.toResponse(r));
  }

  async findOne(id: string) {
    return this.toResponse(await this.require(id));
  }

  async create(dto: CreateSlaRuleDto) {
    const existing = await this.rules.findOne({
      where: { priority: dto.priority },
    });
    if (existing) {
      throw new ConflictException(
        `SLA rule for priority "${dto.priority}" already exists`,
      );
    }
    const saved = await this.rules.save(
      this.rules.create({
        name: dto.name.trim(),
        priority: dto.priority,
        targetHours: dto.targetHours,
        escalateAtPercent: dto.escalateAtPercent ?? 80,
        status: 'active',
      }),
    );
    return this.toResponse(saved);
  }

  async update(id: string, dto: UpdateSlaRuleDto) {
    const rule = await this.require(id);
    if (dto.priority !== undefined && dto.priority !== rule.priority) {
      const clash = await this.rules.findOne({
        where: { priority: dto.priority },
      });
      if (clash && String(clash.id) !== String(rule.id)) {
        throw new ConflictException(
          `SLA rule for priority "${dto.priority}" already exists`,
        );
      }
      rule.priority = dto.priority;
    }
    if (dto.name !== undefined) rule.name = dto.name.trim();
    if (dto.targetHours !== undefined) rule.targetHours = dto.targetHours;
    if (dto.escalateAtPercent !== undefined) {
      rule.escalateAtPercent = dto.escalateAtPercent;
    }
    if (dto.status !== undefined) rule.status = dto.status;
    const saved = await this.rules.save(rule);
    return this.toResponse(saved);
  }

  private async require(id: string) {
    const rule = await this.rules.findOne({ where: { id } });
    if (!rule) {
      throw new NotFoundException(`SLA rule ${id} not found`);
    }
    return rule;
  }

  private toResponse(r: SlaRule) {
    return {
      id: String(r.id),
      name: r.name,
      priority: r.priority,
      targetHours: r.targetHours,
      escalateAtPercent: r.escalateAtPercent,
      status: r.status,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
}
