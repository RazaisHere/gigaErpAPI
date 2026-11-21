import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateMemberDto {
  @ApiPropertyOptional({
    description: 'Existing user id to add to the department',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional()
  @ValidateIf((o: CreateMemberDto) => !o.userId)
  @IsString()
  @Length(2, 255)
  name?: string;

  @ApiPropertyOptional()
  @ValidateIf((o: CreateMemberDto) => !o.userId)
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 30)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 20)
  employeeCode?: string;

  @ApiProperty()
  @IsString()
  departmentId!: string;

  @ApiPropertyOptional({ description: 'Temp password when creating a new user' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  temporaryPassword?: string;
}
