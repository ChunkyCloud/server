import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DatabaseModule } from '../database/database.module';
import { QueuesModule } from '../queues/queues.module';
import { StatsModule } from '../stats/stats.module';
import { UserSchema } from './schemas/user.schema';
import { UsersService } from './users.service';

@Module({
  imports: [
    DatabaseModule,
    QueuesModule,
    MongooseModule.forFeature([{ name: 'User', schema: UserSchema }]),
    forwardRef(() => StatsModule),
  ],
  providers: [UsersService],
  exports: [UsersService],
  controllers: [],
})
export class UsersModule {}
