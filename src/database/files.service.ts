import { Injectable } from '@nestjs/common';
import { GridFSBucket, ObjectId } from 'mongodb';

@Injectable()
export class FilesService {
  constructor(private readonly gridfsBucket: GridFSBucket) {}

  getFile(id: string) {
    return this.gridfsBucket.find({ _id: new ObjectId(id) }).next();
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
}
