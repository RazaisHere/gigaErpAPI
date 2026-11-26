import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsString, Length, Min } from 'class-validator';

export class CreateCaseCategoryDto {
  @ApiProperty({ example: 'Billing Dispute' })
  @IsString()
  @Length(2, 120)
  name!: string;

  @ApiProperty({ description: 'departments.id', example: '1' })
  @IsString()
  defaultDepartmentId!: string;

  @ApiPropertyOptional({ default: 48 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  defaultSlaHours?: number;
}
