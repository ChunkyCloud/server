import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class TaskPollQueryDto {
  @ApiPropertyOptional({
    description: 'Available RAM in bytes for a new task',
    type: 'integer',
    minimum: 0,
    maximum: Number.MAX_SAFE_INTEGER,
    default: 0,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  availableRam: number = 0;
}
