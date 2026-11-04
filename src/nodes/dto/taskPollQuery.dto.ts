import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, Max, Min } from 'class-validator';

export class TaskPollQueryDto {
  @ApiPropertyOptional({
    description: 'Memory limit, in megabytes, for a new task',
    type: 'integer',
    minimum: 0,
    maximum: Number.MAX_SAFE_INTEGER,
    default: 0,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  memoryLimit: number = 0;

  @ApiPropertyOptional({
    description:
      'Whether to prioritize tasks from jobs owned by the node owner',
    type: 'boolean',
    default: true,
  })
  @Type(() => Boolean)
  @IsBoolean()
  prioritizeOwner: boolean = true;
}
