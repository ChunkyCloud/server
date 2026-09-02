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
    },
    required: ['id', 'width', 'height'],
    selfRequired: true,
  })
  job!: {
    id: number;
    width: number;
    height: number;
  };

  @ApiProperty({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        x: { type: 'number' },
        y: { type: 'number' },
        width: { type: 'number' },
        height: { type: 'number' },
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
      required: ['x', 'y', 'width', 'height', 'image'],
    },
  })
  tiles!: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    image: { url: string };
    dump?: { url: string };
  }>;
}
