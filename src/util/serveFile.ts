import { Response } from 'express';
import { Readable } from 'stream';
import { createGzip } from 'zlib';

export function serveFile(
  getStream: (id: string) => Readable,
  file,
  res: Response,
  options: { ifModifiedSince?: string; contentType?: string; gzip?: boolean },
) {
  if (file == null) {
    throw new Error('File not found');
  }
  return new Promise<void>((resolve, reject) => {
    const headers = {
      'Content-Type':
        options.contentType || file.contentType || 'application/octet-stream',
      'Last-Modified': file.uploadDate.toUTCString(),
    };
    if (!options.gzip) {
      headers['Content-Length'] = file.length;
    }
    if (
      options.ifModifiedSince != null &&
      Date.parse(options.ifModifiedSince) >=
        Math.ceil(file.uploadDate.getTime() / 1000)
    ) {
      res.status(304).set(headers).end();
      resolve();
    } else {
      const readStream = getStream(file._id.toString());
      if (options.gzip) {
        headers['Content-Encoding'] = 'gzip';
      }
      res.set(headers);
      readStream.on('end', () => resolve());
      readStream.on('error', (err) => reject(err));
      if (options.gzip) {
        readStream.pipe(createGzip()).pipe(res);
      } else {
        readStream.pipe(res);
      }
    }
  });
}
