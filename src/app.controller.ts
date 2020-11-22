import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  private readonly publicRabbitMqUri: string = process.env.PUBLIC_RABBITMQ_URL;

  constructor(private readonly appService: AppService) {}

  @Get('info')
  getInfo() {
    return {
      version: 2,
      rabbitMq: this.publicRabbitMqUri,
    };
  }
}
