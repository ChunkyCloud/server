const bodyParser = require('body-parser')
const Busboy = require('busboy')
const { getDumpInfo } = require('chunky-dump-reader')
const fileUpload = require('express-fileupload')
const path = require('path')
const proxy = require('express-http-proxy')
const queues = require('./queues')
const { serveFile } = require('./util')

module.exports = (app, db, config) => {
  app.get('/info', (req, res) => {
    res.json({
      version: 1,
      rabbitMq: config.publicRabbitMqUri
    }).end()
  })

  app.get('/jobs', (req, res) => {
    if (req.query.order === 'asc') {
      db.getJobs(req.query.lastId, 'asc', Math.min(500, req.query.count || 100))
      .then((jobs) => res.json(jobs).end())
      .catch((e) => {
        console.log('Could not fetch jobs', e)
        res.status(500).end()
      })
    } else if (req.query.order === 'desc' || req.query.order == null) {
      db.getJobs(req.query.lastId, 'desc', Math.min(500, req.query.count || 100))
      .then((jobs) => res.json(jobs).end())
      .catch((e) => {
        console.log('Could not fetch jobs', e)
        res.status(500).end()
      })
    } else {
      res.status(400).send('Invalid order').end()
    }
  })

  app.post('/jobs', fileUpload(), (req, res) => {
    if (!req.files) {
      return res.status(400).send('scene files missing').end()
    }
    const { foliage, grass, scene, octree, skymap } = req.files
    if (foliage == null || grass == null || scene == null || octree == null) {
      return res.status(400).send('scene files incomplete').end()
    }

    db.addJob({
      created: new Date(),
      spp: 0,
      targetSpp: 1000
    })
    .then((job) => {
      Promise.all([
        db.addJobFile(job._id, 'foliage', foliage.data).then(({ id }) => id),
        db.addJobFile(job._id, 'grass', grass.data).then(({ id }) => id),
        db.addJobFile(job._id, 'scene', scene.data).then(({ id }) => id),
        db.addJobFile(job._id, 'octree', octree.data).then(({ id }) => id),
        skymap ? db.addJobFile(job._id, 'skymap', skymap.data, skymap.name).then(({ id }) => id) : Promise.resolve(null)
      ])
      .then(([ foliageId, grassId, sceneId, octreeId, skymapId ]) =>
        db.updateJob(job._id, { foliageId, grassId, sceneId, octreeId, skymapId })
      )
      .then(() =>
        queues.addJob(job._id, 10, 100) // 10 tasks à 100 spp
        .then(() => res.status(201).json(job).end())
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

  app.post('/jobs/:id/fork', fileUpload(), (req, res) => {
    if (!req.files) {
      return res.status(400).send('scene file missing').end()
    }
    const { scene, skymap } = req.files
    if (scene == null) {
      return res.status(400).send('scene file missing').end()
    }

    db.getJobById(req.params.id)
    .then((parent) => {
      if (!parent) {
        return res.status(404).send('job not found').end()
      }
      return db.addJob({
        created: new Date(),
        spp: 0,
        targetSpp: 1000
      })
      .then((job) =>
        Promise.all([
          db.addJobFile(job._id, 'scene', scene.data).then(({ id }) => id),
          skymap ? db.addJobFile(job._id, 'skymap', skymap.data, skymap.name).then(({ id })) : Promise.resolve(null)
        ])
        .then(([ sceneId, skymapId ]) =>
          db.updateJob(job._id, {
            forkedFrom: parent._id,
            sceneId,
            foliageId: parent.foliageId,
            grassId: parent.grassId,
            octreeId: parent.octreeId,
            skymapId
          })
        )
        .then(() =>
          queues.addJob(job._id, 10, 100) // 10 tasks à 100 spp
          .then(() => res.status(201).json(Object.assign({}, job, { parent: parent._id })).end())
          .catch((e) => {
            console.log('Could not add the tasks to the queue', e)
            res.status(500).end()
          })
        )
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
          {
            type: 'foliage',
            url: `/jobs/${job.forkedFrom || job._id}/files/scene.foliage`
          },
          {
            type: 'grass',
            url: `/jobs/${job.forkedFrom || job._id}/files/scene.grass`
          },
          {
            type: 'scene',
            url: `/jobs/${job._id}/files/scene.json`
          },
          {
            type: 'octree',
            url: `/jobs/${job.forkedFrom || job._id}/files/scene.octree`
          }
        ]
        if (job.skymapId) {
          job.files.push({
            type: 'skymap',
            url: `/jobs/${job.forkedFrom || job._id}/files/skymap`
          })
        }
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

  const files = {
    foliage: { name: 'scene.foliage', field: 'foliageId' },
    grass: { name: 'scene.grass', field: 'grassId' },
    scene: { name: 'scene.json', field: 'sceneId' },
    octree: { name: 'scene.octree', field: 'octreeId' }
  }
  Object.keys(files).map((type) => {
    app.get(`/jobs/:id/files/${files[type].name}`, (req, res) => {
      db.getJobById(req.params.id)
      .then((job) => {
        if (job) {
          return db.getFile(job[files[type].field])
          .then((file) => serveFile(db.gfs, file, res, {}))
          .then(() => res.end())
        } else {
          res.status(404).end()
        }
      })
      .catch((e) => {
        console.error(e)
        res.status(500).end()
      })
    })
  })

  app.put('/jobs/:id', (req, res) => {
    db.getJobById(req.params.id)
    .then((job) => {
      if (job) {
        const delta = parseInt(req.body.incTargetSpp)
        if (delta > 0) {
          return db.increaseJobTargetSpp(job._id, delta)
          .then(() => {
            const normalTasks = Math.max(0, Math.floor(delta / 100) - 1)
            const lastTask = delta - normalTasks * 100
            return Promise.all([
              normalTasks > 0 ? queues.addJob(job._id, normalTasks, 100) : Promise.resolve(),
              lastTask > 0 ? queues.addJob(job._id, 1, lastTask) : Promise.resolve()
            ])
            .then(() => res.status(204).end())
            .catch((e) => {
              console.log('Could not add the tasks to the queue', e)
              res.status(500).end()
            })
          })
        } else {
          res.status(400).end()
        }
      } else {
        res.status(404).end()
      }
    })
    .catch((e) => {
      console.error(e)
      res.status(500).end()
    })
  })

  app.get(`/jobs/:id/files/skymap`, (req, res) => {
    db.getJobById(req.params.id)
    .then((job) => {
      if (job && job.skymapId) {
        return db.getFile(job.skymapId)
        .then((file) => {
          res.set('Content-Disposition', `inline; filename="${file.filename}"`)
          res.set('X-Filename', file.filename) // this is used by the render node
          return serveFile(db.gfs, file, res, {})
        })
        .then(() => res.end())
      } else {
        res.status(404).end()
      }
    })
    .catch((e) => {
      console.error(e)
      res.status(500).end()
    })
  })

  app.get('/jobs/:id/latest.dump', (req, res) => {
    db.getJobById(req.params.id)
    .then((job) => {
      if (job) {
        return db.getLatestDump(req.params.id)
        .then((file) => {
          if (file) {
            return serveFile(db.gfs, file, res, {})
          } else {
            res.status(204)
          }
        })
        .then(() => res.end())
      } else {
        res.status(404).end()
      }
    })
    .catch((e) => {
      console.error(e)
      res.status(500)
    })
  })

  app.get('/jobs/:id/latest.png', (req, res) => {
    db.getLatestPicture(req.params.id)
    .then((file) => {
      if (file) {
        return serveFile(db.gfs, file, res, { contentType: 'image/png' })
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
    db.getJobById(req.params.id)
    .then((job) => {
      if (!job) {
        return res.status(404).end()
      }

      const busboy = new Busboy({ headers: req.headers })
      const promises = []
      let invalid = false
      let dumpInfo

      return new Promise((resolve, reject) => {
        busboy.on('file', (field, file, filename, encoding, mimetype) => {
          if (field === 'dump') {
            const stream = db.writeLatestDump(req.params.id)
            file.on('data', (data) => stream.write(data))
            file.on('end', () => {
              stream.end()
              resolve()
            })
            stream.on('error', reject)
            file.on('error', reject)
            dumpInfo = getDumpInfo(file)
          } else if (field === 'picture') {
            const stream = db.writeLatestPicture(req.params.id)
            file.on('data', (data) => stream.write(data))
            file.on('end', () => {
              stream.end()
              resolve()
            })
            stream.on('error', reject)
            file.on('error', reject)
          } else {
            invalid = true
            return res.status(400).end('invalid files')
          }
        })
        busboy.on('finish', resolve)
        busboy.on('error', reject)
        req.pipe(busboy)
      })
      .then(() => {
        if (invalid) {
          return
        }
        
        return dumpInfo.then((dump) => {
          return db.updateJob(job._id, { spp: dump.spp })
          .then(() => res.status(204).end())
        })
      })
    })
    .catch((e) => {
      console.error(e)
      res.status(500).end()
    })
  })

  app.get('/stats', (req, res) => {
    queues.getStats()
    .then((stats) => res.json(stats).end())
    .catch((e) => {
      console.error(e)
      res.status(500).end()
    })
  })

  app.get('/swagger.yml', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'doc', 'swagger.yml'))
  })

  app.get('/badge/renderNodes.svg', proxy('https://img.shields.io', {
    forwardPathAsync: (req, res) => queues.getStats()
      .then(({ renderNodes }) => {
        const color = renderNodes.length === 0 ? 'red' : 'brightgreen'
        return `/badge/RS%20render%20nodes-${renderNodes}-${color}.svg`
      }),
      intercept: (rsp, data, req, res, callback) => {
        res.set('cache-control', 'max-age=300')
        callback(null, data)
      }
  }))
}
