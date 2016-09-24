const path = require('path')
const mkdirp = require('mkdirp-then')
const queues = require('./queues')

function moveFile (file, dest) {
  return new Promise((resolve, reject) => {
    file.mv(dest, (err) => {
      if (err) {
        reject(err)
      } else {
        resolve()
      }
    })
  })
}

module.exports = (app, db, config) => {
  app.post('/jobs', (req, res) => {
    if (!req.files) {
      return res.status(400).send('scene files missing')
    }
    const { foliage, grass, scene, octree } = req.files
    if (foliage == null || grass == null || scene == null || octree == null) {
      return res.status(400).send('scene files incomplete')
    }

    db.addJob({
      created: new Date(),
      spp: 0,
      targetSpp: 1000
    })
    .then((job) => {
      const sceneDir = path.join(config.sceneDir, job._id.toString())
      return mkdirp(sceneDir)
      .then(() => Promise.all([
        moveFile(foliage, path.join(sceneDir, 'scene.foliage')),
        moveFile(grass, path.join(sceneDir, 'scene.grass')),
        moveFile(scene, path.join(sceneDir, 'scene.json')),
        moveFile(octree, path.join(sceneDir, 'scene.octree'))
      ]))
      .then(() =>
        queues.addJob(job._id, 10, 100) // 10 tasks à 100 spp
        .then(() => res.status(202).json(job).end())
        .catch((e) => {
          console.log('Could not add the tasks to the queue', e)
          res.status(500).end()
        })
      )
    })
    .catch((e) => {
      console.error('Could not create the job', e)
      res.status(500).end()
    })
  })

  app.get('/jobs/:id', (req, res) => {
    db.getJobById(req.params.id)
    .then((job) => {
      if (job) {
        res.json(job).end()
      } else {
        res.status(404).end()
      }
    })
    .catch((e) => {
      console.error(e)
      res.status(500).end()
    })
  })
}
