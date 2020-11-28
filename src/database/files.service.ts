import { Injectable } from '@nestjs/common';
import { GridFSBucket, ObjectId } from 'mongodb';
import { join } from 'path';
import { Readable } from 'stream';

@Injectable()
export class FilesService {
  constructor(private readonly gridfsBucket: GridFSBucket) {}

  getFileById(id: string) {
    return this.gridfsBucket.find({ _id: new ObjectId(id) }).next();
  }

  getFileByNameAndHash(filename: string, md5: string, type: string) {
    const filter: object = { filename, md5 };
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
    filename: string = `${jobId.toHexString()}.${type}`,
  ): Promise<{ _id: ObjectId; filename: string }> {
    return new Promise((resolve, reject) => {
      const stream = new Readable();
      stream.push(content);
      stream.push(null); // EOF

      stream
        .pipe(
          this.gridfsBucket.openUploadStream(filename, {
            metadata: {
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
}
