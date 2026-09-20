import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RenderJobEvent } from './entities/renderJobEvent.entity';
import { JobHistoryService } from './jobHistory.service';

@Module({
  imports: [TypeOrmModule.forFeature([RenderJobEvent])],
  providers: [JobHistoryService],
  exports: [JobHistoryService],
})
export class JobHistoryModule {}
