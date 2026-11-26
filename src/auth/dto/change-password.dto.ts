import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import {
  COGNITO_PASSWORD_REQUIREMENTS_MESSAGE,
  IsCognitoPassword,
} from '../utils/cognito-password.policy';

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @ApiProperty({
    minLength: 8,
    description: COGNITO_PASSWORD_REQUIREMENTS_MESSAGE,
  })
  @IsString()
  @IsCognitoPassword()
  newPassword!: string;
}
