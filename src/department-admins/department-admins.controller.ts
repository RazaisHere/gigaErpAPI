import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { DepartmentAdminsService } from './department-admins.service';
import { CreateDepartmentAdminDto } from './dto/create-department-admin.dto';
import { UpdateDepartmentAdminDto } from './dto/update-department-admin.dto';

@ApiTags('department-admins')
@ApiBearerAuth()
@Roles('superadmin')
@Controller('department-admins')
export class DepartmentAdminsController {
  constructor(private readonly admins: DepartmentAdminsService) {}

  @Get()
  @ApiOperation({ summary: 'List department admins' })
  findAll() {
    return this.admins.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Create department admin' })
  create(@Body() body: CreateDepartmentAdminDto) {
    return this.admins.create(body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update department admin profile / status' })
  update(@Param('id') id: string, @Body() body: UpdateDepartmentAdminDto) {
    return this.admins.update(id, body);
  }

  @Post(':id/reset-password')
  @ApiOperation({ summary: 'Reset password and force change on next login' })
  resetPassword(@Param('id') id: string) {
    return this.admins.resetPassword(id);
  }

  @Post(':id/disable')
  @ApiOperation({ summary: 'Disable department admin login' })
  disable(@Param('id') id: string) {
    return this.admins.disable(id);
  }

  @Post(':id/enable')
  @ApiOperation({ summary: 'Enable department admin login' })
  enable(@Param('id') id: string) {
    return this.admins.enable(id);
  }
}
