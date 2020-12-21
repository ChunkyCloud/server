import { Controller, Get, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { Resourcepack } from './resourcepack.interface';
import { ResourcepacksService } from './resourcepacks.service';

@Controller('resourcepacks')
export class ResourcepacksController {
  constructor(private readonly resourcepacks: ResourcepacksService) {}

  @Get()
  async getResourcepacks(): Promise<Resourcepack[]> {
    const resourcepacks = await this.resourcepacks.getResourcepacks();
    return resourcepacks.filter((resourcepack) => !resourcepack.hidden);
  }

  @Get(':name')
  getResourcepack(@Param('name') name: string, @Res() res: Response) {
    res.sendFile(
      this.resourcepacks.getResourcepackPath(name),
      {
        maxAge: '14d',
      },
      (err) => {
        if (err) {
          if (err['code'] === 'ENOENT') {
            res.status(404).end();
          } else {
            res.status(500).end();
          }
        }
      },
    );
  }
}
