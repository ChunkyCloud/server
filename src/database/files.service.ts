import {Inject, Injectable} from '@nestjs/common';
import { ObjectId } from 'mongodb';
import { Readable, Writable } from 'stream';
import {InjectModel} from "@nestjs/mongoose";
import { Client as MinioClient } from 'minio';
import { MINIO_CONNECTION } from 'nestjs-minio';
import { Model } from 'mongoose';
import {FileEntry, FileEntryDocument} from "./schemas/fileEntry.schema";

@Injectable()
export class FilesService {
  private readonly bucket = 'scene-files';

  constructor(
    @InjectModel('FileEntry') private readonly filesDb: Model<FileEntryDocument>,
    @Inject(MINIO_CONNECTION) private readonly client: MinioClient
  ) {}

  getFileById(id: string) {
    return this.filesDb.findById(id).exec();
  }

  getFileStream(id: string) {
    const out = new Readable();
    const filename = (new ObjectId(id)).toHexString();
    this.client.getObject(this.bucket, filename).then(
      (stream) => {
        stream.on('end', () => out.push(null));
        stream.on('data', chunk => out.push(chunk));
        stream.on('error', error => out.destroy(error));
      },
      (error) => out.destroy(error)
    )
    return out;
  }

  async getFileContentAsString(id: string): Promise<string> {
    const stream = await this.getFileStream(id);
    const chunks = [];
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
  }

  addJobFile(
    jobId: ObjectId,
    type: string,
    content: Buffer,
    filename = `${jobId.toHexString()}.${type}`,
    spp?: number
  ): Promise<{ _id: ObjectId; filename: string }> {
    return this.addFile(type, content, filename, jobId, spp)
  }

  addJobFileStream(
    jobId: ObjectId,
    type: string,
    filename = `${jobId.toHexString()}.${type}`,
    writeToStream: (stream: Writable) => void,
  ): Promise<{ _id: ObjectId; filename: string }> {
    return this.addFileStream(type, filename, writeToStream, jobId);
  }

  addFile(
    type: string,
    content: Buffer,
    filename: string,
    jobId?: ObjectId,
    spp?: number
  ): Promise<{ _id: ObjectId; filename: string }> {
    return this.addFileStream(type, filename,(stream) => {
      stream.end(content);
    }, jobId, spp);
  }

  async addFileStream(
    type: string,
    filename: string,
    writeToStream: (stream: Writable) => void,
    jobId?: ObjectId,
    spp?: number
  ): Promise<{ _id: ObjectId; filename: string }> {
    const entry = new FileEntry();
    entry.filename = filename;
    entry.type = type;
    entry.job = jobId;
    entry.spp = spp;

    await this.filesDb.create(entry);
    try {
      const inStream = new Writable();
      const outStream = new Readable();

      inStream.on('data', chunk => outStream.push(chunk));
      inStream.on('finish', () => outStream.push(null));
      inStream.on('error', error => outStream.destroy(error));

      const put = this.client.putObject(this.bucket, entry._id.toHexString(), outStream);
      writeToStream(inStream);
      await put;
    } catch (e) {
      // Cleanup file if an error occurred
      await this.filesDb.remove(entry).exec();
      await this.client.removeObject(this.bucket, entry._id.toHexString());
      throw e;
    }
    return entry;
  }

  getJobFile(
    jobId: ObjectId | string,
    type: string,
  ): Promise<{ _id: ObjectId; filename: string }> {
    return this.filesDb.findById(jobId).findOne(e => e.type == type).exec();
  }

  async deleteJobFiles(jobId: ObjectId | string): Promise<void> {
    const files = await this.filesDb
      .find({'job': new ObjectId(jobId)})
      .map(entry => entry._id.toHexString())
      .exec();
    await this.client.removeObjects(this.bucket, files);
  }

  async getOldFiles(
    type: string,
    olderThan: Date,
  ): Promise<Array<{ _id: ObjectId; filename: string; length: number }>> {
    const files = await this.filesDb
      .find({'type': type})
      .find(entry => entry._id.getTimestamp() < olderThan)
      .exec();
    return this.fileEntryConv(files);
  }

  async getOldJobFiles(
    id: ObjectId | string,
    type: 'dump' | 'picture',
  ): Promise<Array<{ _id: ObjectId; filename: string; length: number }>> {
    const files = await this.filesDb
      .find({'type': type, 'job': new ObjectId(id)})
      .sort({ _id: -1 })
      .skip(1)
      .exec();
    return this.fileEntryConv(files);
  }

  private fileEntryConv(files: FileEntryDocument[]): Promise<Array<{ _id: ObjectId; filename: string; length: number }>> {
    return Promise.all(files.map(async file => {
      const obj = await this.client.getObject(this.bucket, file._id.toHexString());
      return {
        _id: file.id,
        filename: file.filename,
        length: obj.readableLength
      }
    }));
  }

  async deleteFile(id: ObjectId): Promise<void> {
    await this.client.removeObject(this.bucket, id.toHexString());
    await this.filesDb.findByIdAndRemove(id);
  }
}
