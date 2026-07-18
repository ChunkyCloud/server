import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ResourcePack } from './entities/resourcePack.entity';
import { ResourcePacksController } from './resourcePacks.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ResourcePack])],
  controllers: [ResourcePacksController],
})
export class ResourcePacksModule {}
