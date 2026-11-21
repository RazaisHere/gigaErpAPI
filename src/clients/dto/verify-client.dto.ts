import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import {
  IsPakistaniCnic,
  IsPakistaniMobile,
} from '../validators/pk-contact.validator';

export const VERIFY_ACTIONS = [
  'approve',
  'reject',
  'request_information',
  'under_review',
] as const;

export class VerifyClientDto {
  @ApiProperty({ enum: VERIFY_ACTIONS })
  @IsIn([...VERIFY_ACTIONS])
  action!: (typeof VERIFY_ACTIONS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  /** Optional workspace-side corrections; validated when provided. */
  @ApiPropertyOptional({ example: '35202-1234567-1' })
  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsPakistaniCnic()
  cnic?: string;

  @ApiPropertyOptional({ example: '0300-1234567' })
  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsPakistaniMobile()
  mobile?: string;
}
