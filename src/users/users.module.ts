import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobHistoryModule } from '../jobs/jobHistory.module';
import { NodesModule } from '../nodes/nodes.module';
import { StorageModule } from '../storage/storage.module';
import { AuthIdentity } from './entities/authIdentity.entity';
import { User } from './entities/user.entity';
import { UserNodesController } from './userNodes.controller';
import { UsersController } from './users.controller';

@Module({
  imports: [
    JobHistoryModule,
    TypeOrmModule.forFeature([User, AuthIdentity]),
    NodesModule,
    StorageModule,
  ],
  controllers: [UsersController, UserNodesController],
})
export class UsersModule {}
