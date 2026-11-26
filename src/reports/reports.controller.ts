import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequestUser } from '../auth/types/jwt-payload';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@Roles('superadmin', 'department_admin', 'employee')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('cases')
  @ApiOperation({
    summary: 'Case report — counts by status, priority, SLA, department',
  })
  cases(@CurrentUser() user: RequestUser) {
    return this.reports.casesReport(user);
  }

  @Get('department-performance')
  @ApiOperation({
    summary: 'Per-department open/closed/overdue + average case age',
  })
  departmentPerformance(@CurrentUser() user: RequestUser) {
    return this.reports.departmentPerformance(user);
  }

  @Get('collections')
  @ApiOperation({
    summary:
      'Collections summary (ERP). Superadmin or Finance/Recovery only.',
  })
  collections(@CurrentUser() user: RequestUser) {
    return this.reports.collectionsSummary(user);
  }
}
