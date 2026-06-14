import {
  GetObjectCommand,
  HeadObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
  StorageClass,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StorageService {
  readonly #s3Client: S3Client;
  readonly #storageClass: StorageClass | undefined;
  private readonly bucket: string;

  constructor(config: ConfigService) {
    this.#s3Client = new S3Client({
      endpoint: config.getOrThrow('S3_URL'),
      region: config.get('S3_REGION', 'us-east-1'),
      credentials: {
        accessKeyId: config.getOrThrow('S3_ACCESS_KEY'),
        secretAccessKey: config.getOrThrow('S3_SECRET_KEY'),
      },
    });
    this.#storageClass = config.get('S3_STORAGE_CLASS');
    this.bucket = config.getOrThrow('S3_BUCKET');
  }

  getUploadUrl(
    key: string,
    expiresInSeconds: number = 5 * 60,
  ): Promise<string> {
    return getSignedUrl(
      this.#s3Client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        StorageClass: this.#storageClass,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
      {
        expiresIn: expiresInSeconds,
      },
    );
  }

  getDownloadUrl(
    key: string,
    expiresInSeconds: number = 5 * 60,
  ): Promise<string> {
    return getSignedUrl(
      this.#s3Client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
      {
        expiresIn: expiresInSeconds,
      },
    );
  }

  async getAsString(key: string): Promise<string> {
    try {
      const res = await this.#s3Client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      if (!res.Body) {
        throw new Error(`Failed to read ${key}`);
      }
      return res.Body?.transformToString('utf8');
    } catch (e) {
      if (e instanceof NoSuchKey) {
        throw new NotFoundException(`Key ${key} not found`, { cause: e });
      }
      throw e;
    }
  }

  async checkKeyExists(key: string): Promise<boolean> {
    try {
      await this.#s3Client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );

      return true;
    } catch {
      return false;
    }
  }
}
