import { ApiProperty } from '@nestjs/swagger';

export class FinishMergeTaskResponse {
  @ApiProperty({
    type: 'object',
    properties: {
      image: {
        type: 'string',
        format: 'uri',
        description: 'The URL to upload the final merged image to (as PNG)',
      },
      thumbnailImage: {
        type: 'string',
        format: 'uri',
        description:
          'The URL to upload a thumbnail of the final merged image to (as JPEG with a resolution of max 512x512 and quality of 80%)',
      },
      dump: {
        type: 'string',
        format: 'uri',
        description: 'The URL to upload the dump file to',
      },
    },
    required: ['image', 'thumbnailImage'],
    selfRequired: true,
  })
  uploadUrls!: {
    image: string;
    thumbnailImage: string;
    dump?: string;
  };
}
