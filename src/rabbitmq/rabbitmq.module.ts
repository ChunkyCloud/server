import { Module } from '@nestjs/common';
import { RabbitMQController } from './rabbitmq.controller';
import { RabbitMQService } from './rabbitmq.service';

@Module({
  imports: [],
  controllers: [RabbitMQController],
  providers: [RabbitMQService],
})
export class AppModule {}
