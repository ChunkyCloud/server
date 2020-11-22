import { Module } from '@nestjs/common';
import { QueuesService } from './queues.service';

@Module({
  imports: [],
  providers: [QueuesService],
})
export class QueuesModule {}
