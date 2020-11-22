import { Response } from 'express';
import { Readable } from 'stream';

export function serveFile(
  getStream: (id: string) => Readable,
  file,
  res: Response,
  options: { ifModifiedSince?: string; contentType?: string },
) {
  if (file == null) {
    throw new Error('File not found');
  }
  return new Promise<void>((resolve, reject) => {
    if (
      options.ifModifiedSince != null &&
      Date.parse(options.ifModifiedSince) >=
        Math.ceil(file.uploadDate.getTime() / 1000)
    ) {
      res.status(304).set({
        'Content-Type':
          options.contentType || file.contentType || 'application/octet-stream',
        'Content-Length': file.length,
        'Last-Modified': file.uploadDate.toUTCString(),
      });
      resolve();
    } else {
      const readStream = getStream(file._id.toString());
      res.set({
        'Content-Type':
          options.contentType || file.contentType || 'application/octet-stream',
        'Content-Length': file.length,
        'Last-Modified': file.uploadDate.toUTCString(),
      });
      readStream.on('end', () => resolve());
      readStream.on('error', (err) => reject(err));
      readStream.pipe(res);
    }
  });
}
