import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { CASE_PRIORITIES, CASE_STATUSES } from '../case-transitions';

export const CASE_QUEUES = [
  'all',
  'unassigned',
  'overdue',
  'closed',
  'assigned',
  'waiting_on_client',
  'incoming_handoffs',
  'outgoing_handoffs',
] as const;

export class ListCasesQueryDto {
  @ApiPropertyOptional({ enum: CASE_QUEUES })
  @IsOptional()
  @IsIn([...CASE_QUEUES])
  queue?: (typeof CASE_QUEUES)[number];

  @ApiPropertyOptional({ description: 'Department id or code' })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({ enum: CASE_STATUSES })
  @IsOptional()
  @IsIn([...CASE_STATUSES])
  status?: (typeof CASE_STATUSES)[number];

  @ApiPropertyOptional({ enum: CASE_PRIORITIES })
  @IsOptional()
  @IsIn([...CASE_PRIORITIES])
  priority?: (typeof CASE_PRIORITIES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
