import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CognitoModule } from '../cognito/cognito.module';
import { Department } from '../users/entities/department.entity';
import { DepartmentUser } from '../users/entities/department-user.entity';
import { Role } from '../users/entities/role.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/entities/user-role.entity';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';

@Module({
  imports: [
    CognitoModule,
    TypeOrmModule.forFeature(
      [User, Role, UserRole, Department, DepartmentUser],
      'workspace',
    ),
  ],
  controllers: [MembersController],
  providers: [MembersService],
})
export class MembersModule {}
