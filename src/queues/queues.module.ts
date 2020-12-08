import { Module } from '@nestjs/common';
import { QueuesService } from './queues.service';

@Module({
  imports: [],
  providers: [QueuesService],
  exports: [QueuesService],
})
export class QueuesModule {}
