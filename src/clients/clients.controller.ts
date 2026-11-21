import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequestUser } from '../auth/types/jwt-payload';
import { ClientsService } from './clients.service';
import { ListClientsQueryDto } from './dto/list-clients.query.dto';
import { VerifyClientDto } from './dto/verify-client.dto';

@ApiTags('clients')
@ApiBearerAuth()
@Roles('superadmin', 'department_admin', 'employee')
@Controller('clients')
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Get()
  @ApiOperation({
    summary: 'Client directory (client_links + live src_clients)',
  })
  list(@Query() query: ListClientsQueryDto) {
    return this.clients.list(query);
  }

  @Get('verifications')
  @ApiOperation({ summary: 'Pending (or filtered) client verifications' })
  verifications(@Query() query: ListClientsQueryDto) {
    return this.clients.listVerifications(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Client 360 — profile, live sales, related cases',
  })
  findOne(@Param('id') id: string) {
    return this.clients.findOne(id);
  }

  @Post(':id/verify')
  @HttpCode(200)
  @Roles('superadmin', 'department_admin')
  @ApiOperation({
    summary: 'Verify client — approve / reject / request_information / under_review',
  })
  verify(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: VerifyClientDto,
  ) {
    return this.clients.verify(user, id, body);
  }
}
