const mongo = require('mongodb')
const mongoose = require('mongoose')
const { Readable } = require('stream')

const jobSchema = {
  created: Date,
  spp: Number,
  targetSpp: Number,
  forkedFrom: mongoose.SchemaTypes.ObjectId,
  files: mongoose.SchemaTypes.Mixed
}

const jobModel = mongoose.model('Job', jobSchema);

function dbApi(db, gridFsBucket) {
  const api = {}

  api.addJob = (job) => jobModel.create(job)

  api.getJobs = (lastId, order, limit) => {
    let find = {}
    if (lastId) {
      if (order === 'asc') {
        find = { _id: { $gt: new mongo.ObjectId(lastId) } }
      } else if (order === 'desc') {
        find = { _id: { $lt: new mongo.ObjectId(lastId) } }
      } else {
        throw new Error(`Order must be 'asc' or 'desc', but was ${order}`)
      }
    }

    return jobModel
      .find(find)
      .sort({ _id: order === 'asc' ? 1 : -1 })
      .limit(limit)
      .exec()
  }

  api.getJobById = (id) => jobModel.findById(id)

  api.addJobFile = (jobId, type, content, filename) => new Promise((resolve, reject) => {
    const stream = new Readable()
    stream.push(content)
    stream.push(null) // EOF

    stream
      .pipe(gridFsBucket.openUploadStream(filename || `${jobId}.${type}`, { metadata: { type } }))
      .on('error', (err) => {
        reject(err)
      })
      .on('finish', (file) => {
        resolve({ file, id: file._id })
      })
  })

  api.getFileStream = (id) => gridFsBucket.openDownloadStream(new mongo.ObjectId(id))

  api.updateJob = (id, fields) => jobModel.findByIdAndUpdate(id, fields, { new: true })

  api.increaseJobTargetSpp = (id, delta) =>
    jobModel.updateOne({ _id: new mongo.ObjectId(id) }, { $inc: { targetSpp: delta } }).exec()

  api.getFile = (id) => gridFsBucket.find({ _id: id }).next()

  api.getLatestDump = (jobId) => new Promise((resolve, reject) => {
    gridFsBucket.find({
      'metadata.job': new mongo.ObjectId(jobId),
      'metadata.type': 'dump'
    }).limit(1).sort({ $natural: -1 }).toArray((err, files) => {
      if (err) {
        reject(err)
      } else {
        if (files.length === 0) {
          resolve(null)
        } else {
          resolve(files[0])
        }
      }
    })
  })

  api.writeLatestDump = (jobId) => gridFsBucket.openUploadStream(`${jobId}.dump`, {
    metadata: {
      job: new mongo.ObjectId(jobId),
      type: 'dump'
    }
  })

  api.getLatestPicture = (jobId) => new Promise((resolve, reject) => {
    gridFsBucket.find({
      'metadata.job': new mongo.ObjectId(jobId),
      'metadata.type': 'picture'
    }).limit(1).sort({ $natural: -1 }).toArray((err, files) => {
      if (err) {
        reject(err)
      } else {
        if (files.length === 0) {
          resolve(null)
        } else {
          resolve(files[0])
        }
      }
    })
  })

  api.writeLatestPicture = (jobId) => gridFsBucket.openUploadStream(`${jobId}.png`, {
    metadata: {
      job: new mongo.ObjectId(jobId),
      type: 'picture'
    }
  })

  api.getStats = async () => {
    const jobCount = await jobModel.estimatedDocumentCount().exec()
    return {
      jobCount
    }
  }

  return api
}

module.exports = (url) => new Promise((resolve, reject) => {
  mongoose.Promise = global.Promise
  mongoose.connect(url, { useNewUrlParser: true, useUnifiedTopology: true, promiseLibrary: global.Promise })
  mongoose.connection.on('error', reject);
  mongoose.connection.once('open', () => {
    const db = mongoose.connection.db;
    resolve(dbApi(db, new mongo.GridFSBucket(db, { bucketName: 'fs' })))
  })
})
