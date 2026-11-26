import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateNotificationTemplateDto } from './dto/create-notification-template.dto';
import { PreviewNotificationTemplateDto } from './dto/preview-notification-template.dto';
import { UpdateNotificationTemplateDto } from './dto/update-notification-template.dto';
import { NotificationTemplatesService } from './notification-templates.service';

@ApiTags('notification-templates')
@ApiBearerAuth()
@Controller('notification-templates')
export class NotificationTemplatesController {
  constructor(private readonly templates: NotificationTemplatesService) {}

  @Get()
  @Roles('superadmin', 'department_admin', 'employee')
  @ApiOperation({ summary: 'List notification templates' })
  findAll() {
    return this.templates.findAll();
  }

  @Get(':id')
  @Roles('superadmin', 'department_admin', 'employee')
  @ApiOperation({ summary: 'Get one notification template' })
  findOne(@Param('id') id: string) {
    return this.templates.findOne(id);
  }

  @Post()
  @Roles('superadmin')
  @ApiOperation({ summary: 'Create notification template (superadmin)' })
  create(@Body() body: CreateNotificationTemplateDto) {
    return this.templates.create(body);
  }

  @Patch(':id')
  @Roles('superadmin')
  @ApiOperation({ summary: 'Update / disable notification template' })
  update(
    @Param('id') id: string,
    @Body() body: UpdateNotificationTemplateDto,
  ) {
    return this.templates.update(id, body);
  }

  @Post(':id/preview')
  @HttpCode(200)
  @Roles('superadmin', 'department_admin', 'employee')
  @ApiOperation({
    summary: 'Preview template with {client_name} / {case_no} placeholders',
  })
  preview(
    @Param('id') id: string,
    @Body() body: PreviewNotificationTemplateDto,
  ) {
    return this.templates.preview(id, body);
  }
}
