import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'node:crypto';
import { Repository } from 'typeorm';
import { CreateNodeDto } from './dto/createNode.dto';
import { RenderNode } from './entities/renderNode.entity';

@Injectable()
export class NodesService {
  private readonly logger = new Logger(NodesService.name);

  constructor(
    @InjectRepository(RenderNode)
    private readonly renderNodes: Repository<RenderNode>,
  ) {}

  async createRenderNode(
    userId: number,
    data: CreateNodeDto,
  ): Promise<{ renderNode: RenderNode; token: string }> {
    const { token, tokenHash } = this.createToken();
    const renderNode = this.renderNodes.create({
      enabled: true,
      name: data.name,
      tokenHash,
      user: { id: userId },
    });
    await this.renderNodes.save(renderNode);
    return {
      renderNode,
      token,
    };
  }

  async getRenderNodeByToken(token: string): Promise<RenderNode | null> {
    if (!token.startsWith('rnd_')) {
      return null;
    }
    const node = await this.renderNodes.findOne({
      where: {
        enabled: true,
        tokenHash: createHash('sha256').update(token).digest('hex'),
      },
    });
    if (node) {
      this.renderNodes
        .update(node.id, { lastSeenAt: new Date() })
        .catch((e) => {
          this.logger.error(
            `Failed to update lastSeen date of node ${node.id}`,
            e,
          );
        });
    }
    return node;
  }

  async resetRenderNodeToken(
    renderNodeId: number,
    options: { assertUserId?: number } = {},
  ): Promise<{ token: string }> {
    const { token, tokenHash } = this.createToken();
    const updated = await this.renderNodes.update(
      options.assertUserId
        ? {
            id: renderNodeId,
            user: { id: options.assertUserId },
          }
        : renderNodeId,
      {
        tokenHash,
      },
    );
    if (updated.affected !== 1) {
      throw new NotFoundException();
    }
    return { token };
  }

  async updateCurrentSamplesPerSecond(
    renderNodeId: number,
    currentSps: number,
  ): Promise<void> {
    await this.renderNodes.update(renderNodeId, {
      currentSps,
      currentSpsUpdatedAt: new Date(),
    });
  }

  private createToken(): { token: string; tokenHash: string } {
    const token = `rnd_${randomBytes(32).toString('base64url')}`;
    const tokenHash = createHash('sha256').update(token).digest('hex');
    return { token, tokenHash };
  }
}
