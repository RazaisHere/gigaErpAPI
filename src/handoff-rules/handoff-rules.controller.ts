import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateHandoffRuleDto } from './dto/create-handoff-rule.dto';
import { UpdateHandoffRuleDto } from './dto/update-handoff-rule.dto';
import { HandoffRulesService } from './handoff-rules.service';

@ApiTags('handoff-rules')
@ApiBearerAuth()
@Controller('handoff-rules')
export class HandoffRulesController {
  constructor(private readonly handoffRules: HandoffRulesService) {}

  @Get()
  @Roles('superadmin', 'department_admin')
  @ApiOperation({ summary: 'List handoff rules' })
  findAll() {
    return this.handoffRules.findAll();
  }

  @Post()
  @Roles('superadmin')
  @ApiOperation({ summary: 'Create handoff rule' })
  create(@Body() body: CreateHandoffRuleDto) {
    return this.handoffRules.create(body);
  }

  @Patch(':id')
  @Roles('superadmin')
  @ApiOperation({ summary: 'Update handoff rule allowed flag' })
  update(@Param('id') id: string, @Body() body: UpdateHandoffRuleDto) {
    return this.handoffRules.update(id, body);
  }

  @Delete(':id')
  @Roles('superadmin')
  @ApiOperation({ summary: 'Delete handoff rule' })
  remove(@Param('id') id: string) {
    return this.handoffRules.remove(id);
  }
}
