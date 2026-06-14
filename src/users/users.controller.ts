import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { NodesService } from 'src/nodes/nodes.service';
import { Repository } from 'typeorm';
import { CurrentUserId } from './auth.guard';
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
}
