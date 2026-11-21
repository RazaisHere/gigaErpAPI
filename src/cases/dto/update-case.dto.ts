import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, ValidateIf } from 'class-validator';
import { CASE_PRIORITIES, CASE_STATUSES } from '../case-transitions';

export class UpdateCaseDto {
  @ApiPropertyOptional({ enum: CASE_STATUSES })
  @IsOptional()
  @IsIn([...CASE_STATUSES])
  status?: (typeof CASE_STATUSES)[number];

  @ApiPropertyOptional({ enum: CASE_PRIORITIES })
  @IsOptional()
  @IsIn([...CASE_PRIORITIES])
  priority?: (typeof CASE_PRIORITIES)[number];

  @ApiPropertyOptional({
    description: 'Set assignee; pass null/empty to unassign',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '')
  @IsString()
  assigneeUserId?: string | null;
}
