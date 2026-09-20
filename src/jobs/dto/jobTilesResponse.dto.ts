import { ApiProperty } from '@nestjs/swagger';

export class TileResponse {
  @ApiProperty({
    description: 'Horizontal position of the tile in pixels',
    example: 0,
    minimum: 0,
  })
  x!: number;

  @ApiProperty({
    description: 'Vertical position of the tile in pixels',
    example: 0,
    minimum: 0,
  })
  y!: number;

  @ApiProperty({
    description: 'Width of the tile in pixels',
    example: 200,
    minimum: 1,
  })
  width!: number;

  @ApiProperty({
    description: 'Height of the tile in pixels',
    example: 200,
    minimum: 1,
  })
  height!: number;

  @ApiProperty({
    description: 'Rendering progress of the tile',
    example: 0.42,
    minimum: 0,
    maximum: 1,
  })
  progress!: number;

  @ApiProperty({
    type: 'string',
    nullable: true,
    format: 'uri',
    description:
      'URL to access the rendered tile image in PNG format. The URL is guaranteed to remain valid for at least one hour after it is requested.',
  })
  url!: string | null;
}
