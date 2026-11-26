import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';
import {
  COGNITO_PASSWORD_REQUIREMENTS_MESSAGE,
  IsCognitoPassword,
} from '../utils/cognito-password.policy';

export class CompleteNewPasswordDto {
  @ApiProperty({ example: 'user@gigagroup.pk' })
  @IsEmail()
  email!: string;

  @ApiProperty({
    minLength: 8,
    description: COGNITO_PASSWORD_REQUIREMENTS_MESSAGE,
  })
  @IsString()
  @IsCognitoPassword()
  newPassword!: string;

  @ApiProperty({ description: 'Session from NEW_PASSWORD_REQUIRED challenge' })
  @IsString()
  @MinLength(1)
  session!: string;
}
