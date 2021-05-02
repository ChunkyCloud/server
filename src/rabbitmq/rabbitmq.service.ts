import { Injectable } from '@nestjs/common';

@Injectable()
export class RabbitMQService {
  getHello(): string {
    return 'Hello World!';
  }
}
