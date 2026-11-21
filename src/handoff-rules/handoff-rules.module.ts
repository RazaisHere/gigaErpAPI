import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HandoffRule } from '../departments/entities/handoff-rule.entity';
import { Department } from '../users/entities/department.entity';
import { HandoffRulesController } from './handoff-rules.controller';
import { HandoffRulesService } from './handoff-rules.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([HandoffRule, Department], 'workspace'),
  ],
  controllers: [HandoffRulesController],
  providers: [HandoffRulesService],
})
export class HandoffRulesModule {}
