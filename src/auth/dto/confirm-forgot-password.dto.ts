import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';
import {
  COGNITO_PASSWORD_REQUIREMENTS_MESSAGE,
  IsCognitoPassword,
} from '../utils/cognito-password.policy';

export class ConfirmForgotPasswordDto {
  @ApiProperty({ example: 'user@gigagroup.pk' })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'Code from Cognito email/SMS' })
  @IsString()
  @MinLength(1)
  code!: string;

  @ApiProperty({
    minLength: 8,
    description: COGNITO_PASSWORD_REQUIREMENTS_MESSAGE,
  })
  @IsString()
  @IsCognitoPassword()
  newPassword!: string;
}
