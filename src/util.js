/**
 * Sends the given file in the given response.
 * @param file - the file to send
 * @param res - the express response
 * @param {Object} [options] - additional options
 * @param {string} options.ifModifiedSince - the If-Modified-Since header, to use browser caching
 * @param {string} options.contentType - the content type
 */
function serveFile(getStream, file, res, options = {}) {
  return new Promise((resolve, reject) => {
    if (options.ifModifiedSince != null &&
      Date.parse(options.ifModifiedSince) >= Math.ceil(file.uploadDate.getTime() / 1000)) {
      res.status(304).set({
        'Content-Type': options.contentType || file.contentType,
        'Content-Length': file.length,
        'Last-Modified': file.uploadDate.toUTCString()
      })
      resolve()
    } else {
      let readStream = getStream(file._id)
      res.set({
        'Content-Type': options.contentType || file.contentType,
        'Content-Length': file.length,
        'Last-Modified': file.uploadDate.toUTCString()
      })
      readStream.on('end', () => resolve())
      readStream.on('error', (err) => reject(err))
      readStream.pipe(res)
    }
  })
}

module.exports = { serveFile }
