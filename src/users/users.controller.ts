import {
  Controller,
  Get,
  HttpStatus,
  Query,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { RenderJob } from 'src/jobs/entities/job.entity';
import { RenderTaskStatus } from 'src/jobs/entities/task.entity';
import { NodesService } from 'src/nodes/nodes.service';
import { DataSource, In, Repository } from 'typeorm';
import { CurrentUserId } from './auth.guard';
import { UserJobsQueryDto } from './dto/userJobsQuery.dto';
import { UserJobsResponse } from './dto/userJobsResponse.dto';
import {
  UserNodeResponse,
  UserNodesResponse,
} from './dto/userNodesResponse.dto';
import { UserResponse } from './dto/userResponse.dto';
import { User } from './entities/user.entity';

@Controller('/users')
export class UsersController {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly nodes: NodesService,
  ) {}

  @Get('/me')
  @ApiOperation({ summary: 'Get the current user' })
  @ApiBearerAuth('access-token')
  @ApiResponse({ status: HttpStatus.OK, type: UserResponse })
  async getCurrentUser(@CurrentUserId() id: number): Promise<UserResponse> {
    const user = await this.users.findOneOrFail({ where: { id } });
    return {
      id,
      displayName: user.displayName,
    };
  }

  @Get('/me/nodes')
  @ApiOperation({ summary: 'Get the render nodes of the current user' })
  @ApiBearerAuth('access-token')
  @ApiResponse({
    status: HttpStatus.OK,
    isArray: true,
    type: UserNodeResponse,
  })
  async getCurrentUserNodes(
    @CurrentUserId() id: number,
  ): Promise<UserNodesResponse> {
    const user = await this.users.findOneOrFail({
      where: { id },
      relations: { renderNodes: true },
    });
    return user.renderNodes.map((node) => ({
      id: node.id,
      name: node.name,
      lastSeenAt: node.lastSeenAt,
    }));
  }

  @Get('/me/jobs')
  @ApiOperation({ summary: 'Get the render jobs of the current user' })
  @ApiBearerAuth('access-token')
  @ApiResponse({
    status: HttpStatus.OK,
    isArray: true,
    type: UserJobsResponse,
  })
  async getCurrentUserJobs(
    @CurrentUserId() id: number,
    @Query(
      new ValidationPipe({
        transform: true,
        transformOptions: { enableImplicitConversion: true },
        forbidNonWhitelisted: true,
      }),
    )
    query: UserJobsQueryDto,
  ): Promise<UserJobsResponse> {
    const page = query.page;
    const limit = query.limit;
    const [jobs, totalCount] = await this.dataSource
      .getRepository(RenderJob)
      .findAndCount({
        where: {
          user: { id },
          status: query.status ? In(query.status) : undefined,
        },
        order: {
          [query.sort]: query.order,
        },
        relations: { tasks: true },
        skip: (page - 1) * limit,
        take: limit,
      });
    return {
      data: jobs.map((job) => ({
        id: job.id,
        status: job.status,
        progress:
          job.tasks.length === 0
            ? 0
            : job.tasks.filter(
                (task) => task.status === RenderTaskStatus.Completed,
              ).length / job.tasks.length,
        spp: job.spp,
        width: job.width,
        height: job.height,
        createDump: job.createDump,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        finishedAt: job.finishedAt,
        abortedAt: job.abortedAt,
      })),
      extra: {
        page: {
          page,
          size: limit,
        },
        totalCount,
      },
    };
  }
}
