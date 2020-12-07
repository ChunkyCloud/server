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
    return new Promise((resolve, reject) => {
      const stream = new Readable();
      stream.push(content);
      stream.push(null); // EOF

      stream
        .pipe(
          this.gridfsBucket.openUploadStream(filename, {
            metadata: {
              ...metadata,
              job: jobId,
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

  getJobFile(jobId: ObjectId | string, type: string) {
    return new Promise((resolve, reject) => {
      this.gridfsBucket
        .find({
          'metadata.job': jobId,
          'metadata.type': type,
        })
        .limit(1)
        .sort({ $natural: -1 })
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
}
