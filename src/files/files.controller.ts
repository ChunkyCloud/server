import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { DatabaseService } from '../database/files.service';
import { serveFile } from '../util/serveFile';

@Controller('files')
export class FilesController {
  constructor(private readonly db: DatabaseService) {}

  @Get(':id')
  async getFile(
    @Param('id') fileId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const file = await this.db.getFile(fileId);
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
      res.status(404).end();
    }
  }
}
