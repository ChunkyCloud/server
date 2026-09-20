import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CreateNodeDto } from '../nodes/dto/createNode.dto';
import { NodesService } from '../nodes/nodes.service';
import { CurrentUserId } from '../users/auth.guard';
import { CreateNodeResponse } from './dto/createNodeResponse.dto';
import { ResetNodeTokenResponse } from './dto/resetNodeTokenResponse';

@Controller('/nodes')
export class UserNodesController {
  constructor(private readonly nodesService: NodesService) {}

  @ApiOperation({
    summary: 'Create a new render node',
  })
  @ApiBearerAuth('access-token')
  @ApiResponse({ status: HttpStatus.CREATED, type: CreateNodeResponse })
  @Post()
  async createNode(
    @Body() data: CreateNodeDto,
    @CurrentUserId() userId: number,
  ): Promise<CreateNodeResponse> {
    const { renderNode, token } = await this.nodesService.createRenderNode(
      userId,
      data,
    );
    return { id: renderNode.id, token };
  }

  @ApiOperation({
    summary: 'Reset the authentication token of a render node',
  })
  @ApiBearerAuth('access-token')
  @ApiResponse({ status: HttpStatus.OK, type: ResetNodeTokenResponse })
  @HttpCode(HttpStatus.OK)
  @Post('/:id/reset-token')
  async resetNodeToken(
    @Param('id') id: number,
    @CurrentUserId() userId: number,
  ): Promise<ResetNodeTokenResponse> {
    const { token } = await this.nodesService.resetRenderNodeToken(id, {
      assertUserId: userId,
    });
    return { token };
  }
}
