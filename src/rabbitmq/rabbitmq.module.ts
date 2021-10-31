import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { RabbitMqAuthController } from './rabbitmq.controller';

@Module({
  imports: [UsersModule],
  providers: [],
  exports: [],
  controllers: [RabbitMqAuthController],
})
export class RabbitMqModule {}
