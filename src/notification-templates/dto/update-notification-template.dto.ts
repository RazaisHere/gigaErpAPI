import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';

export class UpdateNotificationTemplateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 80)
  @Matches(/^[a-z0-9_]+$/, {
    message: 'templateKey must be lowercase letters, numbers, underscores',
  })
  templateKey?: string;

  @ApiPropertyOptional({ enum: ['Email', 'SMS'] })
  @IsOptional()
  @IsIn(['Email', 'SMS'])
  channel?: 'Email' | 'SMS';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 255)
  subject?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 10000)
  body?: string;

  @ApiPropertyOptional({ enum: ['active', 'disabled'] })
  @IsOptional()
  @IsIn(['active', 'disabled'])
  status?: 'active' | 'disabled';
}
