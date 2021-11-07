import { Inject, Injectable } from '@nestjs/common';
import { Client as MinioClient } from 'minio';
import { MINIO_CONNECTION } from 'nestjs-minio';
import { Resourcepack } from './resourcepack.interface';

@Injectable()
export class ResourcepacksService {
  constructor(@Inject(MINIO_CONNECTION) private readonly client: MinioClient) {}

  async getResourcepacks(): Promise<Resourcepack[]> {
    const resourcepacks = await streamToString(
      await this.client.getObject('config', 'resourcepacks.json'),
    );
    return JSON.parse(resourcepacks);
  }

  getResourcepackUrl(name: string): string {
    const sanitizedName = name.replace(/[^A-Za-z0-9-_.]/g, '');
    return `${process.env.PUBLIC_MINIO_URL}/resourcepacks/${sanitizedName}.zip`;
  }

  async hasResourcepack(name: string): Promise<boolean> {
    const resourcepacks = await this.getResourcepacks();
    return resourcepacks.some((r) => r.name === name);
  }
}

function streamToString(stream) {
  const chunks = [];
  return new Promise<string>((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('error', (err) => reject(err));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}
