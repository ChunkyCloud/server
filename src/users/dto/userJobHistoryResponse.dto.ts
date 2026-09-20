import { ApiProperty } from '@nestjs/swagger';
import {
  RenderJobEventReason,
  RenderJobEventType,
  RenderJobEventVisibility,
} from '../../jobs/entities/renderJobEvent.entity';
import { PaginationInfo } from './userJobsResponse.dto';

export class UserJobHistoryEvent {
  @ApiProperty()
  id!: number;

  @ApiProperty({ enum: RenderJobEventType, enumName: 'RenderJobEventType' })
  type!: RenderJobEventType;

  @ApiProperty({
    enum: RenderJobEventVisibility,
    enumName: 'RenderJobEventVisibility',
  })
  visibility!: RenderJobEventVisibility;

  @ApiProperty({
    type: 'object',
    properties: { id: { type: 'number' } },
    required: ['id'],
  })
  job!: { id: number };

  @ApiProperty({
    type: 'object',
    properties: { id: { type: 'number' } },
    required: ['id'],
    nullable: true,
  })
  task!: { id: number } | null;

  @ApiProperty({
    type: 'object',
    properties: {
      id: { type: 'number' },
      type: { type: 'string', enum: ['renderer', 'worker'] },
    },
    required: ['id', 'type'],
    nullable: true,
  })
  node!: { id: number; type: 'renderer' | 'worker' } | null;

  @ApiProperty({
    type: 'object',
    properties: { code: { type: 'string' }, message: { type: 'string' } },
    required: ['code'],
    nullable: true,
  })
  reason!: RenderJobEventReason | null;

  @ApiProperty()
  createdAt!: Date;
}

export class UserJobHistoryResponse {
  @ApiProperty({ type: UserJobHistoryEvent, isArray: true })
  data!: UserJobHistoryEvent[];

  @ApiProperty()
  extra!: PaginationInfo;
}
