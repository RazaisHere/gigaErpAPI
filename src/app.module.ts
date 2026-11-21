import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { CasesModule } from './cases/cases.module';
import { ClientsModule } from './clients/clients.module';
import configuration from './config/configuration';
import { envValidationSchema } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { DepartmentAdminsModule } from './department-admins/department-admins.module';
import { DepartmentsModule } from './departments/departments.module';
import { HandoffRulesModule } from './handoff-rules/handoff-rules.module';
import { HealthModule } from './health/health.module';
import { MembersModule } from './members/members.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
    }),
    DatabaseModule,
    UsersModule,
    AuthModule,
    HealthModule,
    AdminModule,
    DepartmentsModule,
    DepartmentAdminsModule,
    MembersModule,
    HandoffRulesModule,
    CasesModule,
    ClientsModule,
  ],
})
export class AppModule {}
