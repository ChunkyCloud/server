import { Module } from '@nestjs/common';
import { ResourcepacksController } from './resourcepacks.controller';
import { ResourcepacksService } from './resourcepacks.service';

@Module({
  controllers: [ResourcepacksController],
  providers: [ResourcepacksService],
})
export class ResourcepacksModule {}
