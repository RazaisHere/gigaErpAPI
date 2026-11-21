import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateHandoffRuleDto {
  @ApiProperty()
  @IsString()
  fromDepartmentId!: string;

  @ApiProperty()
  @IsString()
  toDepartmentId!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isAllowed?: boolean;
}
