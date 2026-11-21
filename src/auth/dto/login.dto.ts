import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'muhammad.ali@gigagroup.pk' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Workspace@123' })
  @IsString()
  @MinLength(1)
  password!: string;
}
