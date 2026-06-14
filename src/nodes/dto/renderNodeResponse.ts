import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RenderNodeResponse {
  @ApiProperty()
  id!: number;

  @ApiPropertyOptional()
  name?: string;

  @ApiProperty()
  enabled!: boolean;

  @ApiProperty()
  lastSeenAt?: Date;

  @ApiProperty()
  createdAt?: Date;

  @ApiProperty()
  updatedAt?: Date;
}
