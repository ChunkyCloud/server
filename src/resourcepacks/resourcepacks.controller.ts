import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
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
  async getResourcepack(@Param('name') name: string, @Res() res: Response) {
    try {
      await new Promise<void>((resolve, reject) =>
        res.sendFile(
          this.resourcepacks.getResourcepackPath(name),
          {
            maxAge: '14d',
          },
          (err) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          },
        ),
      );
    } catch (e) {
      if (e) {
        if (e['code'] === 'ENOENT') {
          throw new NotFoundException();
        } else {
          throw e;
        }
      }
    }
  }
}
