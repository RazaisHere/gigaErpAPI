import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class CreateDepartmentDto {
  @ApiProperty({ example: 'Compliance' })
  @IsString()
  @Length(2, 80)
  name!: string;

  @ApiProperty({ example: 'CMP' })
  @IsString()
  @Length(2, 10)
  @Matches(/^[A-Z0-9]+$/, {
    message: 'code must be uppercase letters/numbers',
  })
  code!: string;
}
