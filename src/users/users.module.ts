import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NodesModule } from '../nodes/nodes.module';
import { StorageModule } from '../storage/storage.module';
import { AuthIdentity } from './entities/authIdentity.entity';
import { User } from './entities/user.entity';
import { UsersController } from './users.controller';
import { UserNodesController } from './userNodes.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, AuthIdentity]),
    NodesModule,
    StorageModule,
  ],
  controllers: [UsersController, UserNodesController],
})
export class UsersModule {}
