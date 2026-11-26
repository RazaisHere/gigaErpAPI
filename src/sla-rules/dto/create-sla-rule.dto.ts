import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsString, Length, Max, Min } from 'class-validator';
import { CASE_PRIORITIES } from '../../cases/case-transitions';

export class CreateSlaRuleDto {
  @ApiProperty({ example: 'Critical' })
  @IsString()
  @Length(2, 80)
  name!: string;

  @ApiProperty({ enum: CASE_PRIORITIES, example: 'Urgent' })
  @IsIn([...CASE_PRIORITIES])
  priority!: (typeof CASE_PRIORITIES)[number];

  @ApiProperty({ example: 8 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  targetHours!: number;

  @ApiPropertyOptional({ default: 80, description: 'Escalate at % of target' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  escalateAtPercent?: number;
}
