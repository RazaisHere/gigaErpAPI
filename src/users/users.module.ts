import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Department } from './entities/department.entity';
import { DepartmentUser } from './entities/department-user.entity';
import { Role } from './entities/role.entity';
import { User } from './entities/user.entity';
import { UserRole } from './entities/user-role.entity';
import { UsersService } from './users.service';

@Module({
  imports: [
    TypeOrmModule.forFeature(
      [User, Role, UserRole, Department, DepartmentUser],
      'workspace',
    ),
  ],
  providers: [UsersService],
  exports: [UsersService, TypeOrmModule],
})
export class UsersModule {}
