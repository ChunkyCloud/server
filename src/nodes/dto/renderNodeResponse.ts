import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WorkerNodeResponse } from './workerNodeResponse';

export class RenderNodeResponse extends WorkerNodeResponse {
  @ApiProperty()
  currentSps!: number;

  @ApiPropertyOptional({ type: Date, nullable: true })
  currentSpsUpdatedAt?: Date | null;

  @ApiProperty({
    type: 'object',
    properties: { id: { type: 'number' } },
    required: ['id'],
    selfRequired: true,
  })
  user!: { id: number };
}
