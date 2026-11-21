import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@ApiTags('departments')
@ApiBearerAuth()
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departments: DepartmentsService) {}

  @Get()
  @Roles('superadmin', 'department_admin', 'employee')
  @ApiOperation({ summary: 'List departments' })
  findAll() {
    return this.departments.findAll();
  }

  @Get(':id')
  @Roles('superadmin', 'department_admin', 'employee')
  @ApiOperation({ summary: 'Get one department' })
  findOne(@Param('id') id: string) {
    return this.departments.findOne(id);
  }

  @Post()
  @Roles('superadmin')
  @ApiOperation({ summary: 'Create department (superadmin)' })
  create(@Body() body: CreateDepartmentDto) {
    return this.departments.create(body);
  }

  @Patch(':id')
  @Roles('superadmin')
  @ApiOperation({ summary: 'Update / activate / deactivate department' })
  update(@Param('id') id: string, @Body() body: UpdateDepartmentDto) {
    return this.departments.update(id, body);
  }
}
