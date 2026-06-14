import { ApiProperty } from '@nestjs/swagger';

export class FinishTaskRenderingResponse {
  @ApiProperty({
    type: 'object',
    properties: {
      image: { type: 'string', format: 'uri' },
      dump: { type: 'string', format: 'uri' },
    },
    required: ['image'],
    selfRequired: true,
  })
  uploadUrls!: {
    image: string;
    dump?: string;
  };
}
