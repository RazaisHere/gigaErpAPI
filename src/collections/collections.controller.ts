import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequestUser } from '../auth/types/jwt-payload';
import { CollectionsService } from './collections.service';
import { CreateRecoveryCaseDto } from './dto/create-recovery-case.dto';
import { ListCollectionsQueryDto } from './dto/list-collections.query.dto';

@ApiTags('collections')
@ApiBearerAuth()
@Roles('superadmin', 'department_admin', 'employee')
@Controller('collections')
export class CollectionsController {
  constructor(private readonly collections: CollectionsService) {}

  @Get('outstanding')
  @ApiOperation({
    summary:
      'Outstanding balances (ERP). Superadmin or Finance/Recovery staff.',
  })
  listOutstanding(
    @CurrentUser() user: RequestUser,
    @Query() query: ListCollectionsQueryDto,
  ) {
    return this.collections.listOutstanding(user, query);
  }

  @Get('upcoming-dues')
  @ApiOperation({
    summary: 'Upcoming installment dues (ERP). Default window 90 days.',
  })
  listUpcomingDues(
    @CurrentUser() user: RequestUser,
    @Query() query: ListCollectionsQueryDto,
  ) {
    return this.collections.listUpcomingDues(user, query);
  }

  @Get('receipts')
  @ApiOperation({ summary: 'Receipts / payments (ERP src_receipts)' })
  listReceipts(
    @CurrentUser() user: RequestUser,
    @Query() query: ListCollectionsQueryDto,
  ) {
    return this.collections.listReceipts(user, query);
  }

  @Get('surcharges')
  @ApiOperation({ summary: 'Surcharges / late charges (ERP src_surcharges)' })
  listSurcharges(
    @CurrentUser() user: RequestUser,
    @Query() query: ListCollectionsQueryDto,
  ) {
    return this.collections.listSurcharges(user, query);
  }

  @Post('outstanding/:id/recovery-case')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Create recovery case for outstanding sale (`:id` = source_unitsale_id)',
  })
  createRecoveryCase(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: CreateRecoveryCaseDto,
  ) {
    return this.collections.createRecoveryCase(user, id, body);
  }
}
