import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CognitoModule } from '../cognito/cognito.module';
import { Department } from '../users/entities/department.entity';
import { DepartmentUser } from '../users/entities/department-user.entity';
import { Role } from '../users/entities/role.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/entities/user-role.entity';
import { DepartmentAdminsController } from './department-admins.controller';
import { DepartmentAdminsService } from './department-admins.service';

@Module({
  imports: [
    CognitoModule,
    TypeOrmModule.forFeature(
      [User, Role, UserRole, Department, DepartmentUser],
      'workspace',
    ),
  ],
  controllers: [DepartmentAdminsController],
  providers: [DepartmentAdminsService],
})
export class DepartmentAdminsModule {}
