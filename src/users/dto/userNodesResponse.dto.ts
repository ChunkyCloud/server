import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserNodeResponse {
  @ApiProperty()
  id!: number;

  @ApiPropertyOptional()
  name?: string;

  @ApiPropertyOptional()
  lastSeenAt?: Date;
}

export type UserNodesResponse = UserNodeResponse[];
