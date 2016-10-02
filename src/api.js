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
        job.files = [
          { type: 'grass', url: `/jobs/${job._id}/files/scene.grass` },
          { type: 'foliage', url: `/jobs/${job._id}/files/scene.foliage` },
          { type: 'scene', url: `/jobs/${job._id}/files/scene.json` },
          { type: 'octree', url: `/jobs/${job._id}/files/scene.octree` }
        ]
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

  const files = ['scene.foliage', 'scene.grass', 'scene.json', 'scene.octree']
  files.map((file) => {
    app.get(`/jobs/:id/files/${file}`, (req, res) => {
      if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
        return res.status(400).end()
      }

      const sceneFile = path.join(config.sceneDir, req.params.id, file)
      res.sendFile(sceneFile, (err) => {
        if (err) {
          res.status(500).end()
          console.error('Could not send scene file', err)
        }
      })
    })
  })

  app.get('/jobs/:id/latest.dump', (req, res) => {
    db.getJobById(req.params.id)
    .then((job) => {
      if (job) {
        const dumpFile = path.join(config.sceneDir, req.params.id, 'latest.dump')
        res.sendFile(dumpFile, (err) => {
          if (err) {
            res.status(500).end()
            console.log('Could not send dump file', err)
          }
        })
      } else {
        res.status(404).end()
      }
    })
    .catch((e) => {
      console.error(e)
      res.status(500).end()
    })
  })

  app.get('/jobs/:id/latest.png', (req, res) => {
    db.getJobById(req.params.id)
    .then((job) => {
      if (job) {
        const pictureFile = path.join(config.sceneDir, req.params.id, 'latest.png')
        res.sendFile(pictureFile, (err) => {
          if (err) {
            res.status(500).end()
            console.log('Could not send picture file', err)
          }
        })
      } else {
        res.status(404).end()
      }
    })
    .catch((e) => {
      console.error(e)
      res.status(500).end()
    })
  })

  app.post('/jobs/:id/latestDump', (req, res) => {
    if (!req.files) {
      return res.status(400).send('files missing')
    }
    const { dump, picture } = req.files
    if (dump == null || picture == null) {
      return res.status(400).send('files missing')
    }
    db.getJobById(req.params.id)
    .then((job) => {
      if (job) {
        const dumpFile = path.join(config.sceneDir, req.params.id, 'latest')
        const newDumpFile = path.join(config.sceneDir, req.params.id, Date.now())
        return Promise.all([
          moveFile(dump, `${newDumpFile}.dump`),
          moveFile(dump, `${dumpFile}.dump`),
          moveFile(picture, `${newDumpFile}.png`),
          moveFile(picture, `${dumpFile}.png`)
        ])
        .then(() => res.status(204).end())
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
