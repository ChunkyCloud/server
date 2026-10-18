import { ApiProperty } from '@nestjs/swagger';
import { SkyboxAssetKey, type SkyboxFace } from '../assets';

export class CreateJobResponse {
  @ApiProperty()
  id!: number;

  @ApiProperty({
    type: 'object',
    properties: {
      scene: { type: 'string', format: 'uri' },
      octree: { type: 'string', format: 'uri' },
      emittergrid: { type: 'string', format: 'uri' },
      skymap: { type: 'string', format: 'uri' },
      ...Object.fromEntries(
        Object.values(SkyboxAssetKey).map((key) => [
          key,
          { type: 'string', format: 'uri' },
        ]),
      ),
    },
    additionalProperties: false,
    required: ['scene', 'octree'],
    selfRequired: true,
  })
  uploadUrls!: {
    scene: string;
    octree: string;
    emittergrid?: string;
    skymap?: string;
  } & Partial<Record<SkyboxFace, string>>;
}
