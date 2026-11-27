import { ApiProperty } from '@nestjs/swagger';

export class HistoricalStatsPeriodResponse {
  @ApiProperty({
    type: 'integer',
    minimum: 0,
    description: 'Number of completed jobs, based on finishedAt',
  })
  completedJobs!: number;

  @ApiProperty({
    type: 'integer',
    minimum: 0,
    description: 'Number of completed tasks, based on finishedAt',
  })
  completedTasks!: number;
}

export class HistoricalStatsResponse {
  @ApiProperty({
    type: HistoricalStatsPeriodResponse,
    description: 'Statistics for the last 24 hours',
  })
  last24h!: HistoricalStatsPeriodResponse;

  @ApiProperty({
    type: HistoricalStatsPeriodResponse,
    description: 'Statistics for the last 7 days',
  })
  last7d!: HistoricalStatsPeriodResponse;

  @ApiProperty({ type: HistoricalStatsPeriodResponse })
  allTime!: HistoricalStatsPeriodResponse;
}

export class PublicStatsResponse {
  @ApiProperty({
    type: 'object',
    properties: {
      connected: { type: 'integer', example: 5 },
      rendering: { type: 'integer', example: 3 },
    },
    required: ['connected', 'rendering'],
  })
  nodes!: {
    connected: number;
    rendering: number;
  };

  @ApiProperty({
    type: 'number',
    minimum: 0,
    description:
      'Approximate total current rendering speed in samples per second',
  })
  totalSamplesPerSeconds!: number;

  @ApiProperty({
    type: 'object',
    properties: {
      queued: { type: 'integer', example: 5 },
      running: { type: 'integer', example: 3 },
    },
    required: ['queued', 'running'],
  })
  jobs!: {
    queued: number;
    running: number;
  };

  @ApiProperty({
    type: 'object',
    properties: {
      queued: { type: 'integer', example: 5 },
      running: { type: 'integer', example: 3 },
    },
    required: ['queued', 'running'],
  })
  tasks!: {
    queued: number;
    running: number;
  };

  @ApiProperty({ type: HistoricalStatsResponse })
  historical!: HistoricalStatsResponse;
}
