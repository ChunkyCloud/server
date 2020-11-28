import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ObjectID } from 'mongodb';
import { FilesService } from '../database/files.service';
import { serveFile } from '../util/serveFile';

@Controller('files')
export class FilesController {
  constructor(private readonly db: FilesService) {}

  @Get(':id')
  async getFile(
    @Param('id') fileId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!ObjectID.isValid(fileId)) {
      throw new NotFoundException();
    }

    const file = await this.db.getFileById(fileId);
    if (file) {
      res.set('Content-Disposition', `inline; filename="${file.filename}"`);
      if (file.metadata.type === 'region') {
        res.set('Cache-Control', 'public, max-age=31557600');
      }
      await serveFile((file) => this.db.getFileStream(file), file, res, {
        ifModifiedSince: req.get('If-Modified-Since'),
      });
      res.end();
    } else {
      throw new NotFoundException();
    }
  }
}
