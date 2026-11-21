import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequestUser } from '../auth/types/jwt-payload';
import { CreateMemberDto } from './dto/create-member.dto';
import { MembersService } from './members.service';

@ApiTags('members')
@ApiBearerAuth()
@Controller()
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get('members')
  @Roles('superadmin', 'department_admin')
  @ApiOperation({
    summary: 'List department members (dept admin: own department only)',
  })
  @ApiQuery({ name: 'department', required: false })
  listMembers(
    @CurrentUser() user: RequestUser,
    @Query('department') department?: string,
  ) {
    return this.members.listMembers(user, department);
  }

  @Get('staff')
  @Roles('superadmin')
  @ApiOperation({ summary: 'List workforce employees (superadmin)' })
  listStaff() {
    return this.members.listStaff();
  }

  @Post('members')
  @Roles('superadmin')
  @ApiOperation({ summary: 'Add member (superadmin only)' })
  addMember(@CurrentUser() user: RequestUser, @Body() body: CreateMemberDto) {
    return this.members.addMember(user, body);
  }

  @Delete('members/:id')
  @Roles('superadmin', 'department_admin')
  @ApiOperation({
    summary: 'Remove membership by id (superadmin only; dept admin gets 403)',
  })
  removeMember(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.members.removeMember(user, id);
  }
}
