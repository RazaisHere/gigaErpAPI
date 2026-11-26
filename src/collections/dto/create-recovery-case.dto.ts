import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateRecoveryCaseDto {
  @ApiPropertyOptional({ description: 'Optional internal note on the new case' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
