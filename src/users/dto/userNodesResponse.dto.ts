import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserNodeResponse {
  @ApiProperty()
  id!: number;

  @ApiPropertyOptional({ type: String, nullable: true })
  name?: string | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  lastSeenAt?: Date | null;
}

export type UserNodesResponse = UserNodeResponse[];
