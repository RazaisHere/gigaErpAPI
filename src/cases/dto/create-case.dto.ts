import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { CASE_PRIORITIES } from '../case-transitions';

export class CreateCaseDto {
  @ApiProperty({ description: 'case_categories.id' })
  @IsString()
  categoryId!: string;

  @ApiPropertyOptional({ enum: CASE_PRIORITIES })
  @IsOptional()
  @IsIn([...CASE_PRIORITIES])
  priority?: (typeof CASE_PRIORITIES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  sourceClientId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  sourceUnitsaleId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  sourceUnitId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  sourceReceiptId?: number;

  @ApiPropertyOptional({ description: 'Override category default department' })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assigneeUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
