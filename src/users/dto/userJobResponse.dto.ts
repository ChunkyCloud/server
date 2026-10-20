import { ApiProperty } from '@nestjs/swagger';
import { UserJobItem } from './userJobsResponse.dto';

export class UserJob extends UserJobItem {
  @ApiProperty({
    description:
      'Approximate samples per second this job is currently rendering at',
    example: 125000,
  })
  samplesPerSecond!: number;

  @ApiProperty({
    description: 'Number of tasks of this job that is currently running',
    example: 42,
  })
  runningTasksCount!: number;
}
