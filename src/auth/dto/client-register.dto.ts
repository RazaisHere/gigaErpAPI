import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';
import {
  IsPakistaniCnic,
  IsPakistaniMobile,
} from '../../clients/validators/pk-contact.validator';
import {
  COGNITO_PASSWORD_REQUIREMENTS_MESSAGE,
  IsCognitoPassword,
} from '../utils/cognito-password.policy';

export class ClientRegisterDto {
  @ApiProperty({ example: 'new.client@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({
    minLength: 8,
    example: 'Num123456@@@',
    description: COGNITO_PASSWORD_REQUIREMENTS_MESSAGE,
  })
  @IsString()
  @IsCognitoPassword()
  password!: string;

  @ApiProperty({ example: '21104-4733982-1' })
  @IsString()
  @IsPakistaniCnic()
  cnic!: string;

  @ApiProperty({ example: '0341-5813388' })
  @IsString()
  @IsPakistaniMobile()
  phone!: string;
}
