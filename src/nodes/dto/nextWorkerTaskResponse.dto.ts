import { ApiProperty } from '@nestjs/swagger';

export class NextWorkerTaskResponse {
  @ApiProperty({
    type: 'string',
    enum: ['merge'],
  })
  type!: 'merge';

  @ApiProperty({
    type: 'object',
    properties: {
      id: { type: 'number' },
      width: { type: 'integer' },
      height: { type: 'integer' },
      spp: { type: 'integer' },
      scene: {
        type: 'object',
        properties: {
          url: { type: 'string', format: 'uri' },
          filename: { type: 'string' },
        },
        required: ['url'],
      },
    },
    required: ['id', 'width', 'height', 'spp'],
    selfRequired: true,
  })
  job!: {
    id: number;
    width: number;
    height: number;
    spp: number;
  };

  @ApiProperty({
    type: 'object',
    properties: {
      url: { type: 'string', format: 'uri' },
    },
    required: ['url'],
    selfRequired: true,
  })
  scene!: { url: string };

  @ApiProperty({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        x: { type: 'number' },
        y: { type: 'number' },
        width: { type: 'number' },
        height: { type: 'number' },
        spp: {
          type: 'integer',
          description: 'Samples per pixel contributed by this tile',
        },
        image: {
          type: 'object',
          properties: {
            url: { type: 'string', format: 'uri' },
          },
          required: ['url'],
        },
        dump: {
          type: 'object',
          properties: {
            url: { type: 'string', format: 'uri' },
          },
          required: ['url'],
        },
      },
      required: ['x', 'y', 'width', 'height', 'spp', 'image'],
    },
  })
  tiles!: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    spp: number;
    image: { url: string };
    dump?: { url: string };
  }>;
}
