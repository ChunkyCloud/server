import { ApiProperty } from '@nestjs/swagger';

export class UrlResponse {
  @ApiProperty({ format: 'uri' })
  url!: string;
}
