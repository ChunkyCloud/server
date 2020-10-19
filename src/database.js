const mongo = require('mongodb')
const mongoose = require('mongoose')
const { Readable } = require('stream');

const jobSchema = mongoose.Schema({
  created: Date,
  spp: Number,
  targetSpp: Number,
  forkedFrom: mongoose.SchemaTypes.ObjectId,
  files: mongoose.SchemaTypes.Mixed,
  transient: Boolean,
  finishedAt: Date,
  texturepack: String
})

const jobModel = mongoose.model('Job', jobSchema);

const statsSchema = mongoose.Schema({
  date: { type: Date, required: true, unique: true },
  jobsCreated: { type: Number, default: 0 },
  jobsFinished: { type: Number, default: 0 },
  dumpsMerged: { type: Number, default: 0 }
})

const statsModel = mongoose.model('Statistics', statsSchema, )

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
      .pipe(gridFsBucket.openUploadStream(filename || `${jobId}.${type}`, {
        metadata: {
          job: new mongo.ObjectId(jobId),
          type,
        }
      }))
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

  api.getFile = (id) => gridFsBucket.find({ _id: new mongo.ObjectId(id) }).next()

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

  api.getStats = async (date = new Date()) => {
    const today = new Date(date)
    today.setHours(0)
    today.setMinutes(0)
    today.setSeconds(0)
    today.setMilliseconds(0)

    const todayStats = await statsModel.findOne({ date: today })

    const jobCount = await jobModel.estimatedDocumentCount().exec()
    return {
      jobCount,
      today: todayStats ? {
        date: date.toISOString().substr(0, 10),
        jobsCreated: todayStats.jobsCreated,
        jobsFinished: todayStats.jobsFinished,
        dumpsMerged: todayStats.dumpsMerged
      } : {
        date: date.toISOString().substr(0, 10),
        jobsCreated: 0,
        jobsFinished: 0,
        dumpsMerged: 0
      }
    }
  }

  api.increaseStats = async (inc) => {
    const today = new Date()
    today.setHours(0)
    today.setMinutes(0)
    today.setSeconds(0)
    today.setMilliseconds(0)
    
    await statsModel.findOneAndUpdate(
      { date: today },
      { $inc: inc },
      { upsert: true, setDefaultsOnInsert: true })
  }

  return api
}

module.exports = (url) => new Promise((resolve, reject) => {
  mongoose.Promise = global.Promise
  mongoose.connect(url, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
    useCreateIndex: true,
    promiseLibrary: global.Promise
  })
  mongoose.connection.on('error', reject);
  mongoose.connection.once('open', () => {
    const db = mongoose.connection.db;
    const gfs = new mongo.GridFSBucket(db, { bucketName: 'fs' })

    // delete finished transient jobs after 15 minutes
    setInterval(async () => {
      try {
        const oldJobs = await jobModel.find({ transient: true, finishedAt: { $lt: new Date(Date.now() - 1000 * 60 * 15) } })
        for (const job of oldJobs) {
          try {
            const files = await gfs.find({ "metadata.job": job._id }).toArray()
            await Promise.all(files.map(f => gfs.delete(f._id)))
            await jobModel.deleteOne({ _id: job._id })
            console.log(`Deleted old transient job ${job._id}`)
          } catch (e) {
            console.error(`Could not remove old transient job ${job._id}`, e)
          }
        }
      } catch (e) {
        console.error('Could not remove old transient jobs', e)
      }
    }, 1000 * 60 * 5)

    resolve(dbApi(db, gfs))
  })
})
