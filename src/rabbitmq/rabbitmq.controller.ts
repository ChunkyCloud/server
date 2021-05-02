import { Controller, Post, Body } from '@nestjs/common';
import { RabbitMQService } from './rabbitmq.service';
import { User } from './dto/user.dto';
import { Topic } from './dto/topic.dto';
import { Vhost } from './dto/vhost.dto';
import { Resource } from './dto/resource.dto';

/*
docs: https://github.com/rabbitmq/rabbitmq-server/tree/master/deps/rabbitmq_auth_backend_http
*/

@Controller('rabbitmq')
export class RabbitMQController {
  constructor(private readonly RabbitMQService: RabbitMQService) {}

  @Post('user')
  getUser(@Body() user: User): string {
    return this.RabbitMQService.getHello();
  }

  @Post('vhost')
  getVhost(@Body() vhost: Vhost): string {
    return this.RabbitMQService.getHello();
  }

  @Post('resource')
  getResource(@Body() resource: Resource): string {
    return this.RabbitMQService.getHello();
  }

  @Post('topic')
  getTopic(@Body() topic: Topic): string {
    return this.RabbitMQService.getHello();
  }
}
