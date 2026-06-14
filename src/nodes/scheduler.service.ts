import { InjectDataSource } from '@nestjs/typeorm';
import { LRUCache } from 'lru-cache';
import { StorageService } from 'src/storage/storage.service';
import { DataSource } from 'typeorm';

export class SchedulerService {
  /**
   * This caches signed URLs for job assets. They have a long lifetime, but
   * we don't want anyone to download them. Instead, only the assigned render
   * nodes get the links. By caching them, we avoid extra round trips on
   * every job assignment.
   */
  readonly #jobAssetUrls = new LRUCache({
    max: 1000,
    ttl: 12 * 60 * 60 * 1000, // 12 hours
    fetchMethod: (key: string) =>
      this.storageService.getDownloadUrl(key, 13 * 60 * 60), // 13 hours (overlap)
  });

  constructor(
    private readonly storageService: StorageService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async getAssetUrl(
    jobId: number,
    file: 'scene' | 'octree' | 'emittergrid',
  ): Promise<string> {
    const url = await this.#jobAssetUrls.fetch(
      `jobs/${jobId}/assets/${{ scene: 'scene.json', octree: 'scene.octree2', emittergrid: 'scene.emittergrid' }[file]}`,
    );
    if (!url) {
      throw new Error(`Could not get asset url for job ${jobId} asset ${file}`);
    }
    return url;
  }
}
