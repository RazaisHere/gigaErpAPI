import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SlaRule } from '../cases/entities/sla-rule.entity';
import { SlaRulesController } from './sla-rules.controller';
import { SlaRulesService } from './sla-rules.service';

@Module({
  imports: [TypeOrmModule.forFeature([SlaRule], 'workspace')],
  controllers: [SlaRulesController],
  providers: [SlaRulesService],
  exports: [SlaRulesService],
})
export class SlaRulesModule {}
