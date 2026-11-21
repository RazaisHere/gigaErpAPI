import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class ConfirmForgotPasswordDto {
  @ApiProperty({ example: 'user@gigagroup.pk' })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'Code from Cognito email/SMS' })
  @IsString()
  @MinLength(1)
  code!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}
