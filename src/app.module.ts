import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminModule } from './admin/admin.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { AuthModule } from './auth/auth.module';
import { CaseCategoriesModule } from './case-categories/case-categories.module';
import { CasesModule } from './cases/cases.module';
import { ClientsModule } from './clients/clients.module';
import { CollectionsModule } from './collections/collections.module';
import configuration from './config/configuration';
import { envValidationSchema } from './config/env.validation';
import { DashboardModule } from './dashboard/dashboard.module';
import { DatabaseModule } from './database/database.module';
import { DepartmentAdminsModule } from './department-admins/department-admins.module';
import { DepartmentsModule } from './departments/departments.module';
import { HandoffRulesModule } from './handoff-rules/handoff-rules.module';
import { HealthModule } from './health/health.module';
import { InventoryModule } from './inventory/inventory.module';
import { MeModule } from './me/me.module';
import { MembersModule } from './members/members.module';
import { NotificationTemplatesModule } from './notification-templates/notification-templates.module';
import { ProjectsModule } from './projects/projects.module';
import { ReportsModule } from './reports/reports.module';
import { SalesModule } from './sales/sales.module';
import { SlaRulesModule } from './sla-rules/sla-rules.module';
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
    SalesModule,
    InventoryModule,
    ProjectsModule,
    CollectionsModule,
    CaseCategoriesModule,
    SlaRulesModule,
    NotificationTemplatesModule,
    DashboardModule,
    ReportsModule,
    AuditLogsModule,
    MeModule,
  ],
})
export class AppModule {}




