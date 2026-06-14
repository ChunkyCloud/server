import { ApiProperty } from '@nestjs/swagger';

export class CreateJobResponse {
  @ApiProperty()
  id!: number;

  @ApiProperty({
    type: 'object',
    properties: {
      scene: { type: 'string', format: 'uri' },
      octree: { type: 'string', format: 'uri' },
      emittergrid: { type: 'string', format: 'uri' },
    },
    additionalProperties: false,
    required: ['scene', 'octree', 'emittergrid'],
    selfRequired: true,
  })
  uploadUrls!: {
    scene: string;

    octree: string;

    emittergrid: string;
  };
}
