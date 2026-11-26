import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequestUser } from '../auth/types/jwt-payload';
import { AuditLogsService } from './audit-logs.service';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs.query.dto';

@ApiTags('audit-logs')
@ApiBearerAuth()
@Roles('superadmin', 'department_admin', 'employee')
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogs: AuditLogsService) {}

  @Get()
  @ApiOperation({
    summary:
      'Audit log list (superadmin: all; staff: own department). Newest first.',
  })
  list(@CurrentUser() user: RequestUser, @Query() query: ListAuditLogsQueryDto) {
    return this.auditLogs.list(user, query);
  }
}
