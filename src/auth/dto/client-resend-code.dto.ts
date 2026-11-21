import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ClientResendCodeDto {
  @ApiProperty({ example: 'new.client@example.com' })
  @IsEmail()
  email!: string;
}
