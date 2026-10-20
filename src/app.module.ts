import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobsModule } from './jobs/jobs.module';
import { WorkerNodeCommand } from './nodes/commands/workerNodes.command';
import { NodesModule } from './nodes/nodes.module';
import { ResourcePacksModule } from './resourcePacks/resourcePacks.module';
import { StatsModule } from './stats/stats.module';
import { StorageModule } from './storage/storage.module';
import { AuthModule } from './users/auth.module';
import { UsersModule } from './users/users.module';
import { ScheduleModule } from '@nestjs/schedule';
import { JobCommand } from './jobs/commands/job.commands';

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
      poolSize: parseInt(process.env.MARIADB_POOL_SIZE || '10', 10),
      extra: {
        connectionLimit: parseInt(process.env.MARIADB_POOL_SIZE || '10', 10),
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000,
      },
      supportBigNumbers: true,
    }),
    PassportModule.register({ session: false }),
    ScheduleModule.forRoot(),
    AuthModule,
    forwardRef(() => UsersModule),
    NodesModule,
    JobsModule,
    StorageModule,
    ResourcePacksModule,
    StatsModule,
  ],
  providers: [
    ...JobCommand.registerWithSubCommands(),
    ...WorkerNodeCommand.registerWithSubCommands(),
  ],
})
export class AppModule {}
