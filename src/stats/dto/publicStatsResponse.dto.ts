import { ApiProperty } from '@nestjs/swagger';

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
}
