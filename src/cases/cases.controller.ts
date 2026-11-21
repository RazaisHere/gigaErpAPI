import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequestUser } from '../auth/types/jwt-payload';
import { CasesService } from './cases.service';
import { BulkAssignDto } from './dto/bulk-assign.dto';
import { CreateCaseDto } from './dto/create-case.dto';
import { CreateCaseNoteDto } from './dto/create-case-note.dto';
import { HandoffCaseDto } from './dto/handoff-case.dto';
import { ListCasesQueryDto } from './dto/list-cases.query.dto';
import { UpdateCaseDto } from './dto/update-case.dto';

@ApiTags('cases')
@ApiBearerAuth()
@Roles('superadmin', 'department_admin', 'employee')
@Controller('cases')
export class CasesController {
  constructor(private readonly cases: CasesService) {}

  @Get()
  @ApiOperation({ summary: 'List cases (queues, filters, pagination)' })
  list(@CurrentUser() user: RequestUser, @Query() query: ListCasesQueryDto) {
    return this.cases.list(user, query);
  }

  @Get('export')
  @ApiOperation({ summary: 'Export cases as CSV' })
  @ApiProduces('text/csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="cases.csv"')
  export(@CurrentUser() user: RequestUser, @Query() query: ListCasesQueryDto) {
    return this.cases.exportCsv(user, query);
  }

  @Post('bulk-assign')
  @HttpCode(200)
  @Roles('superadmin')
  @ApiOperation({ summary: 'Bulk assign cases (superadmin)' })
  bulkAssign(@CurrentUser() user: RequestUser, @Body() body: BulkAssignDto) {
    return this.cases.bulkAssign(user, body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get case detail with notes and handoffs' })
  findOne(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.cases.findOne(user, id);
  }

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'Create case' })
  create(@CurrentUser() user: RequestUser, @Body() body: CreateCaseDto) {
    return this.cases.create(user, body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update status, priority, or assignee' })
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: UpdateCaseDto,
  ) {
    return this.cases.update(user, id, body);
  }

  @Post(':id/notes')
  @HttpCode(200)
  @ApiOperation({ summary: 'Add case note' })
  addNote(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: CreateCaseNoteDto,
  ) {
    return this.cases.addNote(user, id, body);
  }

  @Post(':id/handoff')
  @HttpCode(200)
  @ApiOperation({ summary: 'Hand off case to another department' })
  handoff(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: HandoffCaseDto,
  ) {
    return this.cases.handoff(user, id, body);
  }
}
