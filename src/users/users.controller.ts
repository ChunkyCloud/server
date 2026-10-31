import {
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  ParseIntPipe,
  Query,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CreditTransactionLog } from '../accounting/entities/creditTransactionLog.entity';
import { MINIMUM_RENDERNODE_VERSION_CODE } from '../app.constants';
import { RenderJob } from '../jobs/entities/job.entity';
import { JobHistoryService } from '../jobs/jobHistory.service';
import { StorageService } from '../storage/storage.service';
import { CurrentUserId } from './auth.guard';
import { UserJobHistoryQueryDto } from './dto/userJobHistoryQuery.dto';
import { UserJobHistoryResponse } from './dto/userJobHistoryResponse.dto';
import {
  RenderNodeStatus,
  UserNodeResponse,
  UserNodesResponse,
} from './dto/userNodesResponse.dto';
import { UserResponse } from './dto/userResponse.dto';
import { UserTransactionsQueryDto } from './dto/userTransactionsQuery.dto';
import { UserTransactionsResponse } from './dto/userTransactionsResponse.dto';
import { User } from './entities/user.entity';

@Controller('/users')
export class UsersController {
  constructor(
    private readonly jobHistory: JobHistoryService,
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
    const onlineIfSeenSince = new Date();
    onlineIfSeenSince.setMinutes(onlineIfSeenSince.getMinutes() - 3);
    return user.renderNodes.map((node) => ({
      id: node.id,
      name: node.name,
      lastSeenAt: node.lastSeenAt,
      version: node.version,
      currentSps:
        node.currentSpsUpdatedAt &&
        new Date(node.currentSpsUpdatedAt) >= onlineIfSeenSince
          ? node.currentSps
          : null,
      status:
        !node.lastSeenAt || new Date(node.lastSeenAt) < onlineIfSeenSince
          ? RenderNodeStatus.Offline
          : RenderNodeStatus.Online,
      updateRequired: (node.versionCode ?? 0) < MINIMUM_RENDERNODE_VERSION_CODE,
    }));
  }

  @Get('/me/transactions')
  @ApiOperation({ summary: 'Get the transaction history of the current user' })
  @ApiBearerAuth('access-token')
  @ApiResponse({ status: HttpStatus.OK, type: UserTransactionsResponse })
  async getCurrentUserTransactions(
    @CurrentUserId() id: number,
    @Query(
      new ValidationPipe({
        transform: true,
        transformOptions: { enableImplicitConversion: true },
        forbidNonWhitelisted: true,
      }),
    )
    query: UserTransactionsQueryDto,
  ): Promise<UserTransactionsResponse> {
    const { page, limit } = query;
    const [transactions, totalCount] = await this.dataSource
      .getRepository(CreditTransactionLog)
      .findAndCount({
        where: { user: { id } },
        loadRelationIds: { relations: ['job', 'task'], disableMixedMap: true },
        order: { [query.sort]: query.order, id: query.order },
        skip: (page - 1) * limit,
        take: limit,
      });
    return {
      data: transactions.map((transaction) => ({
        id: transaction.id,
        amount: transaction.amount.toString(),
        type: transaction.type,
        job: transaction.job ? { id: transaction.job.id } : null,
        task: transaction.task ? { id: transaction.task.id } : null,
        note: transaction.note,
        details: transaction.details,
        createdAt: transaction.createdAt,
      })),
      extra: {
        page: { page, size: limit },
        totalCount,
      },
    };
  }

  @Get('/me/jobs/:id/history')
  @ApiOperation({
    summary: 'Get the history of a render job of the current user',
  })
  @ApiBearerAuth('access-token')
  @ApiResponse({ status: HttpStatus.OK, type: UserJobHistoryResponse })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Job not found or not owned by the current user',
  })
  async getCurrentUserJobHistory(
    @CurrentUserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    query: UserJobHistoryQueryDto,
  ): Promise<UserJobHistoryResponse> {
    const exists = await this.dataSource.getRepository(RenderJob).exists({
      where: { id, user: { id: userId } },
    });
    if (!exists) throw new NotFoundException();
    return this.jobHistory.getHistoryByJob(this.dataSource.manager, id, query);
  }
}
