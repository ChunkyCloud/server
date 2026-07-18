import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResourcePackResponse } from './dto/resourcePackResponse.dto';
import { ResourcePack } from './entities/resourcePack.entity';

@Controller('resource-packs')
export class ResourcePacksController {
  constructor(
    @InjectRepository(ResourcePack)
    private readonly resourcePacks: Repository<ResourcePack>,
  ) {}

  @ApiOperation({ summary: 'Get all available resource packs' })
  @ApiBearerAuth('access-token')
  @ApiResponse({
    type: ResourcePackResponse,
    isArray: true,
  })
  @Get()
  getResourcePacks(): Promise<ResourcePackResponse[]> {
    return this.resourcePacks.find({
      select: { id: true, name: true, description: true },
    });
  }
}
