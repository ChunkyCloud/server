import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NodesModule } from 'src/nodes/nodes.module';
import { AuthIdentity } from './entities/authIdentity.entity';
import { User } from './entities/user.entity';
import { UsersController } from './users.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User, AuthIdentity]), NodesModule],
  controllers: [UsersController],
})
export class UsersModule {}
