import { ApiProperty } from '@nestjs/swagger';
import { SkyboxAssetKey, type SkyboxFace } from '../../jobs/assets';

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
          filename: { type: 'string' },
        },
        required: ['url'],
      },
      octree: {
        type: 'object',
        properties: {
          url: { type: 'string', format: 'uri' },
          filename: { type: 'string' },
        },
        required: ['url'],
      },
      emittergrid: {
        type: 'object',
        properties: {
          url: { type: 'string', format: 'uri' },
          filename: { type: 'string' },
        },
        required: ['url'],
      },
      skymap: {
        type: 'object',
        properties: {
          url: { type: 'string', format: 'uri' },
          filename: { type: 'string' },
        },
        required: ['url', 'filename'],
      },
      ...Object.fromEntries(
        Object.values(SkyboxAssetKey).map((key) => [
          key,
          {
            type: 'object',
            properties: {
              url: { type: 'string', format: 'uri' },
              filename: { type: 'string' },
            },
            required: ['url', 'filename'],
          },
        ]),
      ),
      resourcePacks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            url: { type: 'string', format: 'uri' },
          },
          required: ['id', 'url'],
        },
      },
    },
    required: ['scene', 'octree', 'resourcePacks'],
    selfRequired: true,
  })
  files!: {
    scene: {
      url: string;
      filename?: string;
    };
    octree: {
      url: string;
      filename?: string;
    };
    emittergrid?: {
      url: string;
      filename?: string;
    };
    skymap?: { url: string; filename: string };
    skybox?: Record<SkyboxFace, { url: string; filename: string }>;
    resourcePacks: Array<{
      id: number;
      url: string;
    }>;
  };
}
