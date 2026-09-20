import { ApiProperty } from '@nestjs/swagger';

export class ResourcePackResponse {
  @ApiProperty({
    description:
      'The ID of this resource pack that can be used when creating a render job',
  })
  id!: number;

  @ApiProperty({ description: 'The name of this resource pack' })
  name!: string;

  @ApiProperty({
    description: 'A description of this resource pack',
    type: 'string',
  })
  description!: string;
}
