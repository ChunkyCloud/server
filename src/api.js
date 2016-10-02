const queues = require('./queues')
const { serveFile } = require('./util')

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
      Promise.all([
        db.addJobFile(job._id, 'foliage', foliage.data),
        db.addJobFile(job._id, 'grass', grass.data),
        db.addJobFile(job._id, 'scene', scene.data),
        db.addJobFile(job._id, 'octree', octree.data)
      ])
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
          { type: 'foliage', url: `/jobs/${job._id}/files/scene.foliage` },
          { type: 'grass', url: `/jobs/${job._id}/files/scene.grass` },
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

  const files = ['foliage', 'grass', 'json', 'octree']
  files.map((file) => {
    app.get(`/jobs/:id/files/${file}`, (req, res) => {
      if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
        return res.status(400).end()
      }

      db.getJobFile(req.params.id, file)
      .then((file) => serveFile(db.gfs, file, res, {}))
      .then(() => res.end())
      .catch((e) => {
        console.error(e)
        res.status(500).end()
      })
    })
  })

  app.get('/jobs/:id/latest.dump', (req, res) => {
    db.getLatestDump(req.params.id)
    .then((file) => {
      if (file) {
        return serveFile(db.gfs, file, res, {})
      } else {
        res.status(404)
      }
    })
    .then(() => res.end())
    .catch((e) => {
      console.error(e)
      res.status(500)
    })
  })

  app.get('/jobs/:id/latest.png', (req, res) => {
    db.getLatestPicture(req.params.id)
    .then((file) => {
      if (file) {
        return serveFile(db.gfs, file, res, {})
      } else {
        res.status(404)
      }
    })
    .then(() => res.end())
    .catch((e) => {
      console.error(e)
      res.status(500)
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
        return Promise.all([
          db.setLatestDump(job._id, dump.data),
          db.setLatestPicture(job._id, picture.data)
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
