import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { Client as MinioClient } from 'minio';
import { MINIO_CONNECTION } from 'nestjs-minio';

@Injectable()
export class RegionCache {
  private readonly bucket = 'region-cache';

  constructor(@Inject(MINIO_CONNECTION) private readonly client: MinioClient) {}

  async addRegionFile(
    filename: string,
    content: Buffer,
  ): Promise<{ objectName: string; filename: string }> {
    const md5 = createHash('md5').update(content).digest('hex').toLowerCase();
    const objectName = `${md5}/${filename}`;
    await this.client.putObject(this.bucket, objectName, content, {
      originalFilename: filename,
      md5,
    });
    return { objectName, filename };
  }

  async getCachedRegionFile(
    filename: string,
    md5: string,
  ): Promise<string | null> {
    const objectName = `${md5.toLowerCase()}/${filename}`;
    try {
      const data = await this.client.statObject(this.bucket, objectName);
      // cached region files are removed after 24 hours so we only return existing
      // files if they are newer than 23 hours
      if (Date.now() - data.lastModified.getTime() < 1000 * 60 * 60 * 23) {
        console.log('reusing', objectName);
        return objectName;
      }
      return null;
    } catch (e) {
      if (e.code === 'NotFound') {
        return null;
      }
      throw e;
    }
  }
}
