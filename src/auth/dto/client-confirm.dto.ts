import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class ClientConfirmDto {
  @ApiProperty({ example: 'new.client@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'Verification code from Cognito email' })
  @IsString()
  @MinLength(1)
  code!: string;
}
