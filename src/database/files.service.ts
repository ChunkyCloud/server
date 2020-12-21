import { Injectable } from '@nestjs/common';
import { GridFSBucket, ObjectId } from 'mongodb';
import { Readable } from 'stream';

@Injectable()
export class FilesService {
  constructor(private readonly gridfsBucket: GridFSBucket) {}

  getFileById(id: string) {
    return this.gridfsBucket.find({ _id: new ObjectId(id) }).next();
  }

  getFileByNameAndHash(filename: string, md5: string, type: string) {
    const filter = { filename, md5 };
    if (type) {
      filter["'metadata.type'"] = type;
    }
    return this.gridfsBucket.find(filter).limit(1).next();
  }

  getFileStream(id: string) {
    return this.gridfsBucket.openDownloadStream(new ObjectId(id));
  }

  getFileContentAsString(id: string): Promise<string> {
    const stream = this.getFileStream(id);
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
    metadata: Record<string, unknown> = {},
  ): Promise<{ _id: ObjectId; filename: string }> {
    return this.addFile(type, content, filename, {
      ...metadata,
      job: jobId,
    });
  }

  addFile(
    type: string,
    content: Buffer,
    filename: string,
    metadata: Record<string, unknown> = {},
  ): Promise<{ _id: ObjectId; filename: string }> {
    return new Promise((resolve, reject) => {
      const stream = new Readable();
      stream.push(content);
      stream.push(null); // EOF

      stream
        .pipe(
          this.gridfsBucket.openUploadStream(filename, {
            metadata: {
              ...metadata,
              type,
            },
          }),
        )
        .on('error', (err) => {
          reject(err);
        })
        .on('finish', (file) => {
          resolve(file);
        });
    });
  }

  getJobFile(
    jobId: ObjectId | string,
    type: string,
  ): Promise<{ _id: ObjectId; filename: string }> {
    return new Promise((resolve, reject) => {
      this.gridfsBucket
        .find({
          'metadata.job': new ObjectId(jobId),
          'metadata.type': type,
        })
        .sort({ uploadDate: -1 })
        .limit(1)
        .toArray((err, files) => {
          if (err) {
            reject(err);
          } else {
            if (files.length === 0) {
              resolve(null);
            } else {
              resolve(files[0]);
            }
          }
        });
    });
  }

  async deleteJobFiles(jobId: ObjectId | string): Promise<void> {
    const files = await this.gridfsBucket
      .find({
        'metadata.job': new ObjectId(jobId),
      })
      .toArray();
    await Promise.all(files.map((f) => this.gridfsBucket.delete(f._id)));
  }

  async getOldFiles(
    type: string,
    olderThan: Date,
  ): Promise<Array<{ _id: ObjectId; filename: string; length: number }>> {
    return this.gridfsBucket
      .find({
        'metadata.type': type,
        uploadDate: { $lt: olderThan },
      })
      .toArray();
  }

  deleteFile(id: ObjectId): Promise<void> {
    return new Promise((resolve, reject) => {
      this.gridfsBucket.delete(id, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}
