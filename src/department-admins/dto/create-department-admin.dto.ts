import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MinLength,
} from 'class-validator';

export class CreateDepartmentAdminDto {
  @ApiProperty()
  @IsString()
  @Length(2, 255)
  name!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 30)
  phone?: string;

  @ApiProperty({ description: 'Department id' })
  @IsString()
  departmentId!: string;

  @ApiPropertyOptional({
    description: 'Temp password; defaults to Workspace@123',
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  temporaryPassword?: string;
}
