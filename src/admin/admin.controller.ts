import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequestUser } from '../auth/types/jwt-payload';

/**
 * Phase 1 stub: proves RolesGuard rejects client on admin routes.
 * Real admin modules replace this in later phases.
 */
@ApiTags('admin')
@ApiBearerAuth()
@Roles('superadmin', 'department_admin', 'employee')
@Controller('admin')
export class AdminController {
  @Get('ping')
  @ApiOperation({ summary: 'Admin-only ping (staff roles; not client)' })
  ping(@CurrentUser() user: RequestUser) {
    return {
      ok: true,
      role: user.roleCode,
      message: 'Admin route reachable',
    };
  }
}
