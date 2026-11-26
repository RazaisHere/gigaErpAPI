import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { ListSalesQueryDto } from './dto/list-sales.query.dto';
import { SalesService } from './sales.service';

@ApiTags('sales')
@ApiBearerAuth()
@Roles('superadmin', 'department_admin', 'employee')
@Controller('sales')
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Get()
  @ApiOperation({
    summary: 'Sales directory (live ERP via src_sale_context)',
  })
  list(@Query() query: ListSalesQueryDto) {
    return this.sales.list(query);
  }

  @Get(':id')
  @ApiOperation({
    summary:
      'Sale 360 — owners, unit/project, installments, receipts, surcharges, related cases',
  })
  findOne(@Param('id') id: string) {
    return this.sales.findOne(id);
  }
}
