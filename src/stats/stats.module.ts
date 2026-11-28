import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

@Module({
  imports: [CacheModule.register()],
  providers: [StatsService],
  controllers: [StatsController],
})
export class StatsModule {}
