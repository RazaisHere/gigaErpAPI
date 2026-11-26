import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CaseEntity } from '../cases/entities/case.entity';
import { Department } from '../users/entities/department.entity';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CaseEntity, Department], 'workspace'),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
