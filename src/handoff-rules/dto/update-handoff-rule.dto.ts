import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateHandoffRuleDto {
  @ApiProperty()
  @IsBoolean()
  isAllowed!: boolean;
}
