import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Length } from 'class-validator';

export class UpdateDepartmentAdminDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 255)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 30)
  phone?: string;

  @ApiPropertyOptional({ description: 'Move admin to another department' })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional({ enum: ['active', 'disabled'] })
  @IsOptional()
  @IsIn(['active', 'disabled'])
  status?: 'active' | 'disabled';
}
