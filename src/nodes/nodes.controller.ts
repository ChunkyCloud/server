import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  CurrentRenderNode,
  CurrentUserId,
  ExpectRenderNode,
} from 'src/users/auth.guard';
import { CreateNodeDto } from './dto/createNode.dto';
import { CreateNodeResponse } from './dto/createNodeResponse.dto';
import { ResetNodeTokenResponse } from './dto/resetNodeTokenResponse';
import { RenderNode } from './entities/renderNode.entity';
import { NodesService } from './nodes.service';

@Controller('/nodes')
export class NodesController {
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
  ) {
    const { token } = await this.nodesService.resetRenderNodeToken(id, {
      assertUserId: userId,
    });
    return { token };
  }

  @ApiOperation({
    summary: 'Get the current render node',
  })
  @ApiBearerAuth('node-token')
  @Get('/me')
  @ExpectRenderNode()
  getCurrentNode(@CurrentRenderNode() renderNode: RenderNode) {
    return renderNode;
  }
}
