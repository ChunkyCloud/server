import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: {
      allowedHeaders: ['Authorization', 'Content-Type'],
      exposedHeaders: ['Location'],
      origin: '*',
    },
  });
  app.useGlobalPipes(new ValidationPipe());
  app.use(cookieParser());
  app.disable('x-powered-by');

  SwaggerModule.setup(
    'api',
    app,
    () =>
      SwaggerModule.createDocument(
        app,
        new DocumentBuilder()
          .setTitle('ChunkyCloud API')
          .setVersion('0.1')
          .addBearerAuth(
            {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
              description: 'User Access Token',
            },
            'access-token',
          )
          .addBearerAuth(
            {
              type: 'http',
              scheme: 'bearer',
              description: 'Render Node Token',
            },
            'node-token',
          )
          .build(),
        {
          operationIdFactory: (_controllerKey, methodKey) => methodKey,
        },
      ),
    {
      customSiteTitle: 'ChunkyCloud API Docs',
    },
  );

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
