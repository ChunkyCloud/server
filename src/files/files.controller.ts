import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ObjectID } from 'mongodb';
import { validate as uuidValidate } from 'uuid';
import { FilesService } from '../database/files.service';
import { serveFile } from '../util/serveFile';
import { DiskFilesService } from './files.service';

@Controller('files')
export class FilesController {
  constructor(
    private readonly db: FilesService,
    private readonly disk: DiskFilesService,
  ) {}

  @Get(':id')
  async getFile(
    @Param('id') fileId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (uuidValidate(fileId)) {
      try {
        await new Promise<void>((resolve, reject) =>
          res.sendFile(this.disk.getFilePath(fileId), (err) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          }),
        );
      } catch (e) {
        if (e['code'] === 'ENOENT') {
          throw new NotFoundException();
        } else {
          throw e;
        }
      }
    }

    if (!ObjectID.isValid(fileId)) {
      throw new NotFoundException();
    }

    const file = await this.db.getFileById(fileId);
    if (file) {
      res.set('Cache-Control', 'public, max-age=31557600');
      res.set('Content-Disposition', `inline; filename="${file.filename}"`);
      if (file.metadata.type === 'skymap') {
        res.set('X-Filename', file.filename); // this is used by the render node
      }
      await serveFile((file) => this.db.getFileStream(file), file, res, {
        ifModifiedSince: req.get('If-Modified-Since'),
      });
    } else {
      throw new NotFoundException();
    }
  }
}
