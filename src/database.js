const mongo = require('mongodb')
const Grid = require('gridfs-stream')
const _ = require('lodash')

function dbApi (db, gfs) {
  const api = {
    gfs
  }

  api.addJob = (job) => new Promise((resolve, reject) => {
    db.collection('jobs').insertOne(job, (err, r) => {
      if (err) {
        reject(err)
      } else {
        const newJob = _.cloneDeep(job)
        newJob._id = r.insertedId
        resolve(newJob)
      }
    })
  })

  api.getJobById = (id) => new Promise((resolve, reject) => {
    db.collection('jobs').findOne({ _id: new mongo.ObjectId(id) }, (err, doc) => {
      if (err) {
        reject(err)
      } else {
        resolve(doc)
      }
    })
  })

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

  api.updateJob = (id, fields) => new Promise((resolve, reject) => {
    db.collection('jobs').updateOne({ _id: new mongo.ObjectId(id) }, { $set: fields }, (err) => {
      if (err) {
        reject(err)
      } else {
        resolve()
      }
    })
  })

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

  return api
}

module.exports = (url) => new Promise((resolve, reject) => {
  mongo.MongoClient.connect(url, (err, db) => {
    if (err) {
      reject(err)
    } else {
      resolve(dbApi(db, Grid(db, mongo)))
    }
  })
})
