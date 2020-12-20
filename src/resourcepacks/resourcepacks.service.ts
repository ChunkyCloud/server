import { Injectable } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import { Readable } from 'stream';
import { Resourcepack } from './resourcepack.interface';

@Injectable()
export class ResourcepacksService {
  private readonly resourcepacksPath = path.resolve(
    process.env.RESOURCEPACKS_PATH,
  );

  async getResourcepacks(): Promise<Resourcepack[]> {
    const resourcepacks = await fs.promises.readFile(
      path.join(this.resourcepacksPath, 'resourcepacks.json'),
      'utf-8',
    );
    return JSON.parse(resourcepacks);
  }

  getResourcepackStream(name: string): Readable {
    return fs.createReadStream(this.getResourcepackPath(name));
  }

  getResourcepackPath(name: string): string {
    const sanitizedName = name.replace(/[^A-Za-z0-9-_.]/g, '');
    return path.join(this.resourcepacksPath, `${sanitizedName}.zip`);
  }

  async hasResourcepack(name: string): Promise<boolean> {
    const resourcepacks = await this.getResourcepacks();
    return resourcepacks.some((r) => r.name === name);
  }
}
