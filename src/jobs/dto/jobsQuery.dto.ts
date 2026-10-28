import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
import { UserJobsQueryDto } from '../../users/dto/userJobsQuery.dto';

export class JobsQueryDto extends UserJobsQueryDto {
  @ApiPropertyOptional({
    type: 'integer',
    description:
      'Filter by the ID of the user who created the job. Private jobs are returned only to their owner.',
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  createdBy?: number;
}
