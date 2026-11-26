import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CaseEntity } from '../cases/entities/case.entity';
import { ClientLink } from '../clients/entities/client-link.entity';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CaseEntity, ClientLink], 'workspace'),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
