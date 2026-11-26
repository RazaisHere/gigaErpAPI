import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateSlaRuleDto } from './dto/create-sla-rule.dto';
import { UpdateSlaRuleDto } from './dto/update-sla-rule.dto';
import { SlaRulesService } from './sla-rules.service';

@ApiTags('sla-rules')
@ApiBearerAuth()
@Controller('sla-rules')
export class SlaRulesController {
  constructor(private readonly slaRules: SlaRulesService) {}

  @Get()
  @Roles('superadmin', 'department_admin', 'employee')
  @ApiOperation({ summary: 'List SLA rules' })
  findAll() {
    return this.slaRules.findAll();
  }

  @Get(':id')
  @Roles('superadmin', 'department_admin', 'employee')
  @ApiOperation({ summary: 'Get one SLA rule' })
  findOne(@Param('id') id: string) {
    return this.slaRules.findOne(id);
  }

  @Post()
  @Roles('superadmin')
  @ApiOperation({ summary: 'Create SLA rule (superadmin)' })
  create(@Body() body: CreateSlaRuleDto) {
    return this.slaRules.create(body);
  }

  @Patch(':id')
  @Roles('superadmin')
  @ApiOperation({ summary: 'Update / disable SLA rule (superadmin)' })
  update(@Param('id') id: string, @Body() body: UpdateSlaRuleDto) {
    return this.slaRules.update(id, body);
  }
}
