import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListMeQueryDto {
  @ApiPropertyOptional({ description: 'Filter by ERP project id' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sourceProjectId?: number;

  @ApiPropertyOptional({ description: 'Filter by ERP unitsale / booking id' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sourceUnitsaleId?: number;

  @ApiPropertyOptional({
    description: 'Upcoming dues: include dues within this many days (default 90)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  withinDays?: number;

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
