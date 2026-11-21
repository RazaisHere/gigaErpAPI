import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';
import {
  IsPakistaniCnic,
  IsPakistaniMobile,
} from '../../clients/validators/pk-contact.validator';

export class ClientRegisterDto {
  @ApiProperty({ example: 'new.client@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8, example: 'Workspace@123' })
  @IsString()
  @MinLength(8)
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
