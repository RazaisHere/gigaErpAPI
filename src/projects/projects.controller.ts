import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { ProjectsService } from './projects.service';

@ApiTags('projects')
@ApiBearerAuth()
@Roles('superadmin', 'department_admin', 'employee')
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: 'Projects list with building/unit counts (ERP)' })
  list() {
    return this.projects.list();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Project detail with buildings' })
  findOne(@Param('id') id: string) {
    return this.projects.findOne(id);
  }
}
