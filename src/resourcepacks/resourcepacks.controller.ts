import { Controller, Get, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { Resourcepack } from './resourcepack.interface';
import { ResourcepacksService } from './resourcepacks.service';

@Controller('resourcepacks')
export class ResourcepacksController {
  constructor(private readonly resourcepacks: ResourcepacksService) {}

  @Get()
  async getResourcepacks(): Promise<Resourcepack[]> {
    try {
      const resourcepacks = await this.resourcepacks.getResourcepacks();
      return resourcepacks.filter((resourcepack) => !resourcepack.hidden);
    } catch (e) {
      if (e.code === 'NotFound') {
        return [];
      }
      throw e;
    }
  }

  @Get(':name')
  async getResourcepack(@Param('name') name: string, @Res() res: Response) {
    res.redirect(301, this.resourcepacks.getResourcepackUrl(name));
    res.end();
    return;
  }
}
