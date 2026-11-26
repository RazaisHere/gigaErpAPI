import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateNotificationTemplateDto } from './dto/create-notification-template.dto';
import { PreviewNotificationTemplateDto } from './dto/preview-notification-template.dto';
import { UpdateNotificationTemplateDto } from './dto/update-notification-template.dto';
import { NotificationTemplate } from './entities/notification-template.entity';

@Injectable()
export class NotificationTemplatesService {
  constructor(
    @InjectRepository(NotificationTemplate, 'workspace')
    private readonly templates: Repository<NotificationTemplate>,
  ) {}

  async findAll() {
    const rows = await this.templates.find({ order: { id: 'ASC' } });
    return rows.map((t) => this.toResponse(t));
  }

  async findOne(id: string) {
    return this.toResponse(await this.require(id));
  }

  async create(dto: CreateNotificationTemplateDto) {
    const key = dto.templateKey.trim();
    const existing = await this.templates.findOne({
      where: { templateKey: key },
    });
    if (existing) {
      throw new ConflictException(`Template key "${key}" already exists`);
    }
    const saved = await this.templates.save(
      this.templates.create({
        name: dto.name.trim(),
        templateKey: key,
        channel: dto.channel,
        subject: dto.subject?.trim() || null,
        body: dto.body,
        status: 'active',
      }),
    );
    return this.toResponse(saved);
  }

  async update(id: string, dto: UpdateNotificationTemplateDto) {
    const template = await this.require(id);
    if (dto.templateKey !== undefined) {
      const key = dto.templateKey.trim();
      const clash = await this.templates.findOne({
        where: { templateKey: key },
      });
      if (clash && String(clash.id) !== String(template.id)) {
        throw new ConflictException(`Template key "${key}" already exists`);
      }
      template.templateKey = key;
    }
    if (dto.name !== undefined) template.name = dto.name.trim();
    if (dto.channel !== undefined) template.channel = dto.channel;
    if (dto.subject !== undefined) {
      template.subject =
        dto.subject === null || dto.subject === ''
          ? null
          : dto.subject.trim();
    }
    if (dto.body !== undefined) template.body = dto.body;
    if (dto.status !== undefined) template.status = dto.status;
    const saved = await this.templates.save(template);
    return this.toResponse(saved);
  }

  async preview(id: string, dto: PreviewNotificationTemplateDto) {
    const template = await this.require(id);
    const vars: Record<string, string> = {
      client_name: dto.clientName?.trim() || 'Client Name',
      case_no: dto.caseNo?.trim() || 'CS-0001',
    };
    return {
      id: String(template.id),
      templateKey: template.templateKey,
      channel: template.channel,
      subject: template.subject
        ? this.render(template.subject, vars)
        : null,
      body: this.render(template.body, vars),
      placeholders: ['{client_name}', '{case_no}'],
    };
  }

  private render(text: string, vars: Record<string, string>) {
    return text
      .replace(/\{client_name\}/g, vars.client_name)
      .replace(/\{case_no\}/g, vars.case_no);
  }

  private async require(id: string) {
    const template = await this.templates.findOne({ where: { id } });
    if (!template) {
      throw new NotFoundException(`Notification template ${id} not found`);
    }
    return template;
  }

  private toResponse(t: NotificationTemplate) {
    return {
      id: String(t.id),
      name: t.name,
      templateKey: t.templateKey,
      channel: t.channel,
      subject: t.subject,
      body: t.body,
      status: t.status,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    };
  }
}
