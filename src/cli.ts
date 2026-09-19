#!/usr/bin/env node
import { CommandFactory } from 'nest-commander';
import { AppModule } from './app.module';

async function bootstrap() {
  await CommandFactory.run(AppModule, {
    abortOnError: false,
    serviceErrorHandler: (error) => {
      console.error(error);
      process.exitCode = 1;
    },
  });
}
void bootstrap();
