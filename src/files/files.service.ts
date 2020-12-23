import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4, validate as validateUuid } from 'uuid';

@Injectable()
export class DiskFilesService {
  getFileStream(id: string) {
    return fs.createReadStream(this.getFilePath(id));
  }

  async writeFile(content: Buffer): Promise<string> {
    const id = uuidv4();
    await fs.promises.writeFile(this.getFilePath(id), content);
    return id;
  }

  getFilePath(id) {
    return path.join('/var/dumps', id);
  }

  async deleteFile(id): Promise<void> {
    if (validateUuid(id)) {
      await fs.promises.unlink(this.getFilePath(id));
    }
  }
}
