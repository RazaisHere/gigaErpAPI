import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListSalesQueryDto {
  @ApiPropertyOptional({ description: 'Search sale no, client, CNIC, unit, project' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: 'Filter by ERP client id' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sourceClientId?: number;

  @ApiPropertyOptional({ description: 'Filter by ERP project id' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sourceProjectId?: number;

  @ApiPropertyOptional({ description: 'Filter by sale_status_id' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  saleStatusId?: number;

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
