import { NestFactory } from '@nestjs/core';
import * as dotenv from 'dotenv';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  if (process.env.CORS_ORIGIN) {
    app.enableCors({ origin: process.env.CORS_ORIGIN });
  }
  await app.listen(process.env.PORT || 3000);
}

dotenv.config();
bootstrap();
