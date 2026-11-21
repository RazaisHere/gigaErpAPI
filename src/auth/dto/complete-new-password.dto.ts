import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class CompleteNewPasswordDto {
  @ApiProperty({ example: 'user@gigagroup.pk' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword!: string;

  @ApiProperty({ description: 'Session from NEW_PASSWORD_REQUIRED challenge' })
  @IsString()
  @MinLength(1)
  session!: string;
}
