import type { SkyMode } from '../../jobs/assets';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RenderJobStatus } from '../../jobs/entities/job.entity';

export class UserJobItem {
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

  @ApiProperty({
    description:
      'Minimum available RAM in bytes required on nodes to run this job',
    type: 'integer',
    minimum: 0,
  })
  minimumRam!: number;

  @ApiProperty()
  hasEmitterGrid!: boolean;

  @ApiProperty({ enum: ['skybox', 'skymap'], nullable: true })
  skyMode!: SkyMode;

  @ApiProperty()
  createDump!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiPropertyOptional({ type: Date, nullable: true })
  startedAt?: Date | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  finishedAt?: Date | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  abortedAt?: Date | null;

  @ApiPropertyOptional({ format: 'uri' })
  thumbnailUrl?: string;
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
  @ApiProperty({ type: UserJobItem, isArray: true })
  data!: UserJobItem[];

  @ApiProperty()
  extra!: PaginationInfo;
}
