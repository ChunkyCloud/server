import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  private readonly publicRabbitMqUri: string = process.env.PUBLIC_RABBITMQ_URL;

  @Get('info')
  getInfo() {
    return {
      version: 3,
      rabbitMq: this.publicRabbitMqUri,
    };
  }
}
