import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientLink } from '../clients/entities/client-link.entity';
import { MeController } from './me.controller';
import { MeService } from './me.service';

@Module({
  imports: [TypeOrmModule.forFeature([ClientLink], 'workspace')],
  controllers: [MeController],
  providers: [MeService],
})
export class MeModule {}
