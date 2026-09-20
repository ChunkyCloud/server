import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WorkerNodeResponse {
  @ApiProperty()
  id!: number;

  @ApiPropertyOptional({ type: String, nullable: true })
  name?: string | null;

  @ApiProperty()
  enabled!: boolean;

  @ApiPropertyOptional({ type: Date, nullable: true })
  lastSeenAt?: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
