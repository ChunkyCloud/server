const mongo = require('mongodb')
const mongoose = require('mongoose')
const Grid = require('gridfs-stream')
const _ = require('lodash')

const jobSchema = {
  created: Date,
  spp: Number,
  targetSpp: Number,
}

const jobModel = mongoose.model('Job', jobSchema);

function dbApi (db, gfs) {
  const api = {
    gfs
  }

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
    const ws = gfs.createWriteStream({
      filename: filename || `${jobId}.${type}`,
      metadata: { type }
    })
    ws.on('close', (file) => {
      resolve({ file, id: ws.id })
    })
    ws.on('error', (err) => reject(err))
    ws.end(content)
  })

  api.updateJob = (id, fields) => jobModel.findByIdAndUpdate(id, fields, { new: true })

  api.increaseJobTargetSpp = (id, delta) =>
    jobModel.updateOne({ _id: new mongo.ObjectId(id) }, { $inc: { targetSpp: delta } }).exec()

  api.getFile = (id) => new Promise((resolve, reject) => {
    gfs.findOne({ _id: id }, (err, file) => {
      if (err) {
        reject(err)
      } else {
        resolve(file)
      }
    })
  })

  api.getLatestDump = (jobId) => new Promise((resolve, reject) => {
    gfs.files.find({
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

  api.writeLatestDump = (jobId) => gfs.createWriteStream({
    filename: `${jobId}.dump`,
    metadata: {
      job: new mongo.ObjectId(jobId),
      type: 'dump'
    }
  })

  api.getLatestPicture = (jobId) => new Promise((resolve, reject) => {
    gfs.files.find({
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

  api.writeLatestPicture = (jobId) => gfs.createWriteStream({
    filename: `${jobId}.png`,
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
  mongoose.connect(url, { useNewUrlParser: true })
  const db = mongoose.connection;
  db.on('error', reject);
  db.once('open', () => {
    resolve(dbApi(db, Grid(db, mongo)))
  })
})
