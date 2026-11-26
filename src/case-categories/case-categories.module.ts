import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CaseCategory } from '../cases/entities/case-category.entity';
import { Department } from '../users/entities/department.entity';
import { CaseCategoriesController } from './case-categories.controller';
import { CaseCategoriesService } from './case-categories.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CaseCategory, Department], 'workspace'),
  ],
  controllers: [CaseCategoriesController],
  providers: [CaseCategoriesService],
  exports: [CaseCategoriesService],
})
export class CaseCategoriesModule {}
