import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreateNotificationTemplateDto {
  @ApiProperty({ example: 'Case resolved' })
  @IsString()
  @Length(2, 120)
  name!: string;

  @ApiProperty({ example: 'case_resolved' })
  @IsString()
  @Length(2, 80)
  @Matches(/^[a-z0-9_]+$/, {
    message: 'templateKey must be lowercase letters, numbers, underscores',
  })
  templateKey!: string;

  @ApiProperty({ enum: ['Email', 'SMS'], example: 'Email' })
  @IsIn(['Email', 'SMS'])
  channel!: 'Email' | 'SMS';

  @ApiPropertyOptional({ example: 'Case {case_no} update' })
  @IsOptional()
  @IsString()
  @Length(0, 255)
  subject?: string;

  @ApiProperty({
    example: 'Dear {client_name}, case {case_no} has been updated.',
  })
  @IsString()
  @Length(1, 10000)
  body!: string;
}
