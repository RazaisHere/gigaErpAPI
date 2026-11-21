import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsString } from 'class-validator';

export class BulkAssignDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  caseIds!: string[];

  @ApiProperty()
  @IsString()
  assigneeUserId!: string;
}
