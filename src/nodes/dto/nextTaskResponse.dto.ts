import { ApiProperty } from '@nestjs/swagger';

export class NextTaskResponse {
  @ApiProperty()
  id!: number;

  @ApiProperty({
    type: 'object',
    properties: {
      id: { type: 'number' },
      width: { type: 'integer' },
      height: { type: 'integer' },
    },
    required: ['id', 'width', 'height'],
    selfRequired: true,
  })
  job!: {
    id: number;
    width: number;
    height: number;
  };

  @ApiProperty()
  spp!: number;

  @ApiProperty({
    type: 'object',
    properties: {
      x: { type: 'number' },
      y: { type: 'number' },
      width: { type: 'number' },
      height: { type: 'number' },
    },
    required: ['x', 'y', 'width', 'height'],
    selfRequired: true,
  })
  tile!: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  @ApiProperty({
    type: 'object',
    properties: {
      scene: {
        type: 'object',
        properties: {
          url: { type: 'string', format: 'uri' },
        },
        required: ['url'],
      },
      octree: {
        type: 'object',
        properties: {
          url: { type: 'string', format: 'uri' },
        },
        required: ['url'],
      },
      emittergrid: {
        type: 'object',
        properties: {
          url: { type: 'string', format: 'uri' },
        },
        required: ['url'],
      },
    },
    required: ['scene', 'octree'],
    selfRequired: true,
  })
  files!: {
    scene: {
      url: string;
    };
    octree: {
      url: string;
    };
    emittergrid?: {
      url: string;
    };
  };
}
