import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { Request } from 'express';
import { AppModule } from './app.module';
import { JobsModule } from './jobs/jobs.module';
import { NodesModule } from './nodes/nodes.module';
import { ResourcePacksModule } from './resourcePacks/resourcePacks.module';
import { StatsModule } from './stats/stats.module';
import { AuthModule } from './users/auth.module';
import { UsersModule } from './users/users.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: (req: Request, callback) => {
      if (req.path.startsWith('/auth/discord')) {
        // Disable CORS for the Discord authorization endpoint
        // The user must visit this endpoint directly in their browser to authorize the application,
        // and Discord will redirect them back to the server with the authorization code.
        callback(null, {
          origin: '',
        });
      } else {
        callback(null, {
          allowedHeaders: ['Authorization', 'Content-Type'],
          origin: '*',
        });
      }
    },
  });
  app.useGlobalPipes(new ValidationPipe());
  app.use(cookieParser());
  app.disable('x-powered-by');

  SwaggerModule.setup(
    'docs',
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
          .build(),
        {
          operationIdFactory: (_controllerKey, methodKey) => methodKey,
          include: [JobsModule, StatsModule, ResourcePacksModule, UsersModule],
        },
      ),
    {
      customSiteTitle: 'ChunkyCloud API Docs',
      yamlDocumentUrl: '/openapi.yaml',
      jsonDocumentUrl: '/openapi.json',
      swaggerOptions: {},
    },
  );

  SwaggerModule.setup(
    'docs/internal',
    app,
    () =>
      SwaggerModule.createDocument(
        app,
        new DocumentBuilder()
          .setTitle('ChunkyCloud Internal API')
          .setDescription(
            'This API is intended for internal use by ChunkyCloud, including communication between the server and worker/render nodes, as well as user authentication.<br/>' +
              'Unless you are developing a render or worker node, you are probably looking for the public API documentation at <a href="/docs">/docs</a>.<br/><br/>' +
              '<strong>Please do not use modified versions of worker or render nodes with the official ChunkyCloud server, as they may be incompatible and could cause unexpected issues.</strong> ' +
              'You are welcome to run your own server and use modified nodes with it. If you make improvements or additions, we would be happy if you considered sharing them with the ChunkyCloud community.',
          )
          .setVersion('0.1')
          .addBearerAuth(
            {
              type: 'http',
              scheme: 'bearer',
              description: 'Render Node Token',
            },
            'renderer-token',
          )
          .addBearerAuth(
            {
              type: 'http',
              scheme: 'bearer',
              description: 'Render Node Token',
            },
            'worker-token',
          )
          // required for node management, which is to be moved to the public api
          .addBearerAuth(
            {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
              description: 'User Access Token',
            },
            'access-token',
          )
          .build(),
        {
          operationIdFactory: (_controllerKey, methodKey) => methodKey,
          include: [NodesModule, AuthModule],
        },
      ),
    {
      customSiteTitle: 'ChunkyCloud Internal API Docs',
      yamlDocumentUrl: '/internal/openapi.yaml',
      jsonDocumentUrl: '/internal/openapi.json',
      swaggerOptions: {},
    },
  );

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
