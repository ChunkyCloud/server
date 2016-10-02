const { MongoClient, ObjectId } = require('mongodb')
const _ = require('lodash')

const addJob = (db) => (job) => new Promise((resolve, reject) => {
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

const getJobById = (db) => (id) => new Promise((resolve, reject) => {
  db.collection('jobs').findOne({ _id: new ObjectId(id) }, (err, doc) => {
    if (err) {
      reject(err)
    } else {
      resolve(doc)
    }
  })
})

module.exports = (url) => new Promise((resolve, reject) => {
  MongoClient.connect(url, (err, db) => {
    if (err) {
      reject(err)
    } else {
      resolve({
        addJob: addJob(db),
        getJobById: getJobById(db)
      })
    }
  })
})
