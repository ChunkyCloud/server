import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum RenderNodeStatus {
  Online = 'online',
  Offline = 'offline',
}

export class UserNodeResponse {
  @ApiProperty()
  id!: number;

  @ApiPropertyOptional({ type: String, nullable: true })
  name?: string | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  lastSeenAt?: Date | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'The software version running on this node.',
  })
  version?: string | null;

  @ApiProperty({ enum: RenderNodeStatus })
  status!: RenderNodeStatus;

  @ApiProperty({
    description:
      'Whether an update is required for this node to continue rendering.',
  })
  updateRequired!: boolean;
}

export type UserNodesResponse = UserNodeResponse[];
