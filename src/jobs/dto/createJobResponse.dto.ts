import { ApiProperty } from '@nestjs/swagger';
import { skyboxFaces, type SkyboxFace } from '../assets';

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
      skybox: {
        type: 'object',
        properties: Object.fromEntries(
          skyboxFaces.map((face) => [face, { type: 'string', format: 'uri' }]),
        ),
        required: [...skyboxFaces],
        additionalProperties: false,
      },
    },
    additionalProperties: false,
    required: ['scene', 'octree', 'emittergrid'],
    selfRequired: true,
  })
  uploadUrls!: {
    scene: string;
    octree: string;
    emittergrid: string;
    skymap?: string;
    skybox?: Record<SkyboxFace, string>;
  };
}
