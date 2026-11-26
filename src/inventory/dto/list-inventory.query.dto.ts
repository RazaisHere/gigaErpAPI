import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListInventoryQueryDto {
  @ApiPropertyOptional({ description: 'Search unit, building, project, type' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: 'Filter by ERP project id' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sourceProjectId?: number;

  @ApiPropertyOptional({ description: 'Filter by ERP building id' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sourceBuildingId?: number;

  @ApiPropertyOptional({ enum: ['Available', 'Sold'] })
  @IsOptional()
  @IsIn(['Available', 'Sold'])
  status?: 'Available' | 'Sold';

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
