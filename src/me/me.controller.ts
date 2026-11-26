import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequestUser } from '../auth/types/jwt-payload';
import { ListMeQueryDto } from './dto/list-me.query.dto';
import { MeService } from './me.service';

@ApiTags('me')
@ApiBearerAuth()
@Roles('client')
@Controller('me')
export class MeController {
  constructor(private readonly me: MeService) {}

  @Get('profile')
  @ApiOperation({
    summary: 'Linked client profile (approved client_link + ERP snapshot)',
  })
  profile(@CurrentUser() user: RequestUser) {
    return this.me.profile(user);
  }

  @Get('summary')
  @ApiOperation({
    summary:
      'Home summary — portfolio totals, next due, project rollups',
  })
  summary(@CurrentUser() user: RequestUser) {
    return this.me.summary(user);
  }

  @Get('projects')
  @ApiOperation({ summary: 'My investments — project rollups list' })
  listProjects(@CurrentUser() user: RequestUser) {
    return this.me.listProjects(user);
  }

  @Get('projects/:sourceProjectId')
  @ApiOperation({
    summary: 'Project hub — project totals + units list',
  })
  getProject(
    @CurrentUser() user: RequestUser,
    @Param('sourceProjectId') sourceProjectId: string,
  ) {
    return this.me.getProject(user, sourceProjectId);
  }

  @Get('units/:sourceUnitsaleId')
  @ApiOperation({
    summary: 'Unit / sale detail — money, next due, installment schedule',
  })
  getUnit(
    @CurrentUser() user: RequestUser,
    @Param('sourceUnitsaleId') sourceUnitsaleId: string,
  ) {
    return this.me.getUnit(user, sourceUnitsaleId);
  }

  @Get('portfolio')
  @ApiOperation({
    summary:
      'My sales / units (optional sourceProjectId / sourceUnitsaleId filters)',
  })
  portfolio(
    @CurrentUser() user: RequestUser,
    @Query() query: ListMeQueryDto,
  ) {
    return this.me.portfolio(user, query);
  }

  @Get('dues')
  @ApiOperation({
    summary:
      'My upcoming installments (optional project / unitsale filters)',
  })
  dues(@CurrentUser() user: RequestUser, @Query() query: ListMeQueryDto) {
    return this.me.dues(user, query);
  }

  @Get('receipts')
  @ApiOperation({
    summary: 'My receipts (optional project / unitsale filters)',
  })
  receipts(@CurrentUser() user: RequestUser, @Query() query: ListMeQueryDto) {
    return this.me.receipts(user, query);
  }

  @Get('surcharges')
  @ApiOperation({
    summary: 'My surcharges (optional project / unitsale filters)',
  })
  surcharges(
    @CurrentUser() user: RequestUser,
    @Query() query: ListMeQueryDto,
  ) {
    return this.me.surcharges(user, query);
  }
}
