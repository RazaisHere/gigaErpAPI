import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class PreviewNotificationTemplateDto {
  @ApiPropertyOptional({ example: 'KIFYATULLAH', default: 'Client Name' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  clientName?: string;

  @ApiPropertyOptional({ example: 'CS-1001', default: 'CS-0001' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  caseNo?: string;
}
