import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HandoffRule } from '../departments/entities/handoff-rule.entity';
import { Department } from '../users/entities/department.entity';
import { User } from '../users/entities/user.entity';
import { CasesController } from './cases.controller';
import { CasesService } from './cases.service';
import { AuditLog } from './entities/audit-log.entity';
import { CaseEntity } from './entities/case.entity';
import { CaseCategory } from './entities/case-category.entity';
import { CaseHandoff } from './entities/case-handoff.entity';
import { CaseNote } from './entities/case-note.entity';
import { SlaRule } from './entities/sla-rule.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature(
      [
        CaseEntity,
        CaseCategory,
        CaseNote,
        CaseHandoff,
        SlaRule,
        AuditLog,
        HandoffRule,
        Department,
        User,
      ],
      'workspace',
    ),
  ],
  controllers: [CasesController],
  providers: [CasesService],
  exports: [CasesService],
})
export class CasesModule {}
