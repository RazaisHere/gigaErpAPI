import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '../cases/entities/audit-log.entity';
import { CaseEntity } from '../cases/entities/case.entity';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { ClientLink } from './entities/client-link.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ClientLink, CaseEntity, AuditLog], 'workspace'),
  ],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}
