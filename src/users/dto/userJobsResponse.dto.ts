import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RenderJobStatus } from 'src/jobs/entities/job.entity';

export class UserJob {
  @ApiProperty()
  id!: number;

  @ApiProperty({
    enum: RenderJobStatus,
    enumName: 'JobStatus',
    example: RenderJobStatus.Running,
  })
  status!: RenderJobStatus;

  @ApiProperty({ minimum: 0, maximum: 1, example: 0.42 })
  progress!: number;

  @ApiProperty({ type: 'integer', example: 100 })
  spp!: number;

  @ApiProperty({ type: 'integer', example: 1920 })
  width!: number;

  @ApiProperty({ type: 'integer', example: 1080 })
  height!: number;

  @ApiProperty()
  hasEmitterGrid!: boolean;

  @ApiProperty()
  createDump!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiPropertyOptional()
  startedAt?: Date;

  @ApiPropertyOptional()
  finishedAt?: Date;

  @ApiPropertyOptional()
  abortedAt?: Date;
}

export class CurrentPage {
  @ApiProperty()
  page!: number;

  @ApiProperty()
  size!: number;
}

export class PaginationInfo {
  @ApiProperty()
  page!: CurrentPage;

  @ApiProperty()
  totalCount!: number;
}

export class UserJobsResponse {
  @ApiProperty({ type: UserJob, isArray: true })
  data!: UserJob[];

  @ApiProperty()
  extra!: PaginationInfo;
}
