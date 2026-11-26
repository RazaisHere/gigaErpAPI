import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { CaseCategoriesService } from './case-categories.service';
import { CreateCaseCategoryDto } from './dto/create-case-category.dto';
import { UpdateCaseCategoryDto } from './dto/update-case-category.dto';

@ApiTags('case-categories')
@ApiBearerAuth()
@Controller('case-categories')
export class CaseCategoriesController {
  constructor(private readonly categories: CaseCategoriesService) {}

  @Get()
  @Roles('superadmin', 'department_admin', 'employee')
  @ApiOperation({ summary: 'List case categories' })
  findAll() {
    return this.categories.findAll();
  }

  @Get(':id')
  @Roles('superadmin', 'department_admin', 'employee')
  @ApiOperation({ summary: 'Get one case category' })
  findOne(@Param('id') id: string) {
    return this.categories.findOne(id);
  }

  @Post()
  @Roles('superadmin')
  @ApiOperation({ summary: 'Create case category (superadmin)' })
  create(@Body() body: CreateCaseCategoryDto) {
    return this.categories.create(body);
  }

  @Patch(':id')
  @Roles('superadmin')
  @ApiOperation({ summary: 'Update / disable case category (superadmin)' })
  update(@Param('id') id: string, @Body() body: UpdateCaseCategoryDto) {
    return this.categories.update(id, body);
  }
}
