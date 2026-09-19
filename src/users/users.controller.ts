import {
  BadRequestException,
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  Query,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { UrlResponse } from '../jobs/dto/urlResponse.dto';
import { RenderJob, RenderJobStatus } from '../jobs/entities/job.entity';
import { StorageService } from '../storage/storage.service';
import { DataSource, In, Repository } from 'typeorm';
import { CurrentUserId } from './auth.guard';
import { UserJobsQueryDto } from './dto/userJobsQuery.dto';
import { UserJob, UserJobsResponse } from './dto/userJobsResponse.dto';
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
    private readonly storageService: StorageService,
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
      avatarUrl: user.avatarUrl,
      credits: user.credits.toString(),
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
      data: await Promise.all(
        jobs.map(async (job) => ({
          id: job.id,
          status: job.status,
          progress: job.getProgress(),
          spp: job.spp,
          width: job.width,
          height: job.height,
          hasEmitterGrid: job.hasEmitterGrid ?? false,
          createDump: job.createDump,
          createdAt: job.createdAt,
          startedAt: job.startedAt,
          finishedAt: job.finishedAt,
          abortedAt: job.abortedAt,
          thumbnailUrl:
            job.status === RenderJobStatus.Completed
              ? await this.storageService.getDownloadUrl(
                  `jobs/${job.id}/result_thumbnail.jpg`,
                  60 * 60, // 1 hour
                  24 * 60 * 60, // 24 hours
                )
              : undefined,
        })),
      ),
      extra: {
        page: {
          page,
          size: limit,
        },
        totalCount,
      },
    };
  }

  @Get('/me/jobs/:id')
  @ApiOperation({ summary: 'Get a render job of the current user' })
  @ApiBearerAuth('access-token')
  @ApiResponse({
    status: HttpStatus.OK,
    isArray: true,
    type: UserJob,
  })
  async getCurrentUserJob(
    @CurrentUserId() userId: number,
    @Param('id') id: number,
  ): Promise<UserJob> {
    const job = await this.dataSource.getRepository(RenderJob).findOne({
      where: { id, user: { id: userId } },
      relations: { tasks: true },
    });
    if (!job) {
      throw new NotFoundException();
    }
    return {
      id: job.id,
      status: job.status,
      progress: job.getProgress(),
      spp: job.spp,
      width: job.width,
      height: job.height,
      hasEmitterGrid: job.hasEmitterGrid ?? false,
      createDump: job.createDump,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      abortedAt: job.abortedAt,
      thumbnailUrl:
        job.status === RenderJobStatus.Completed
          ? await this.storageService.getDownloadUrl(
              `jobs/${job.id}/result_thumbnail.jpg`,
              60 * 60, // 1 hour
              24 * 60 * 60, // 24 hours
            )
          : undefined,
    };
  }

  @Get('/me/jobs/:id/results/:file')
  @ApiOperation({
    summary:
      'Get the download URL for a result file of a render job of the current user',
  })
  @ApiBearerAuth('access-token')
  @ApiParam({
    name: 'file',
    enum: ['image', 'dump'],
    description:
      'The dump is only available if the job was created with createDump set to true',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: UrlResponse,
    description:
      'A download URL for the requested file, valid for at least 1 hour',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: ' The requested file is invalid or not available for this job',
  })
  async getJobResultFile(
    @CurrentUserId() userId: number,
    @Param('id') id: number,
    @Param('file') file: 'image' | 'dump',
  ): Promise<UrlResponse> {
    const job = await this.dataSource.getRepository(RenderJob).findOne({
      where: { id, user: { id: userId } },
    });
    if (!job) {
      throw new NotFoundException();
    }
    if (job.status !== RenderJobStatus.Completed) {
      throw new BadRequestException(
        'Result files not available for incomplete jobs',
      );
    }
    if (file === 'image') {
      return {
        url: await this.storageService.getDownloadUrl(
          `jobs/${job.id}/result.png`,
          60 * 60, // 1 hour
          24 * 60 * 60, // 24 hours
        ),
      };
    } else if (file === 'dump') {
      if (job.createDump !== true) {
        throw new BadRequestException(
          'Dump file not available for jobs created with createDump set to false',
        );
      }
      return {
        url: await this.storageService.getDownloadUrl(
          `jobs/${job.id}/result.dump`,
          60 * 60, // 1 hour
          24 * 60 * 60, // 24 hours
        ),
      };
    } else {
      throw new BadRequestException('Invalid file type');
    }
  }
}
