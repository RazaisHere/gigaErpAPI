import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { ListInventoryQueryDto } from './dto/list-inventory.query.dto';
import { InventoryService } from './inventory.service';

@ApiTags('inventory')
@ApiBearerAuth()
@Roles('superadmin', 'department_admin', 'employee')
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  @ApiOperation({
    summary: 'Inventory units (Available / Sold) from live ERP src_units',
  })
  list(@Query() query: ListInventoryQueryDto) {
    return this.inventory.list(query);
  }
}
