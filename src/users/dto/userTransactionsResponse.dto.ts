import { ApiProperty } from '@nestjs/swagger';
import { CreditTransactionType } from '../../accounting/creditTransaction';
import { PaginationInfo } from './userJobsResponse.dto';

export class UserTransaction {
  @ApiProperty()
  id!: number;

  @ApiProperty({
    type: 'string',
    pattern: '^-?\\d+$',
    example: '-1337',
    description:
      'Signed credit balance change: charges are negative, rewards are positive',
  })
  amount!: string;

  @ApiProperty({
    enum: CreditTransactionType,
    enumName: 'CreditTransactionType',
  })
  type!: CreditTransactionType;

  @ApiProperty({
    type: 'object',
    properties: {
      id: { type: 'number' },
    },
    required: ['id'],
    nullable: true,
  })
  job!: { id: number } | null;

  @ApiProperty({
    type: 'object',
    properties: {
      id: { type: 'number' },
    },
    required: ['id'],
    nullable: true,
  })
  task!: { id: number } | null;

  @ApiProperty({ type: 'string', nullable: true })
  note!: string | null;

  @ApiProperty({ type: 'object', additionalProperties: true, nullable: true })
  details!: Record<string, unknown> | null;

  @ApiProperty()
  createdAt!: Date;
}

export class UserTransactionsResponse {
  @ApiProperty({ type: UserTransaction, isArray: true })
  data!: UserTransaction[];

  @ApiProperty()
  extra!: PaginationInfo;
}
