import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobsModule } from './jobs/jobs.module';
import { NodesModule } from './nodes/nodes.module';
import { StorageModule } from './storage/storage.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'mariadb',
      host: process.env.MARIADB_HOST || 'localhost',
      port: parseInt(process.env.MARIADB_PORT || '3306', 10),
      username: process.env.MARIADB_USER!,
      password: process.env.MARIADB_PASSWORD!,
      database: process.env.MARIADB_DATABASE || 'chunkycloud',
      autoLoadEntities: true,
      synchronize: process.env.TYPEORM_SYNCHRONIZE === 'true',
      invalidWhereValuesBehavior: {
        undefined: 'ignore',
      },
      extra: {
        enableKeepAlive: true,
        keepAliveInitialDelay: 0,
      },
    }),
    PassportModule.register({ session: false }),
    forwardRef(() => UsersModule),
    NodesModule,
    JobsModule,
    StorageModule,
  ],
  providers: [],
})
export class AppModule {}
