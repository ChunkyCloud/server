const bodyParser = require('body-parser')
const Busboy = require('busboy')
const { getValidatedDumpInfo } = require('chunky-dump-reader')
const fileUpload = require('express-fileupload')
const path = require('path')
const proxy = require('express-http-proxy')
const sharp = require('sharp')
const fs = require('fs')
const { ObjectId } = require('mongodb')
const queues = require('./queues')
const { serveFile } = require('./util')

const supportedTexturepacks = ['greenfield', 'chromahills-1.16-v1'] // TODO don't hard-code texturepacks

module.exports = (app, db, config) => {
  app.get('/info', (req, res) => {
    res.json({
      version: 2,
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

  app.post('/jobs', fileUpload(), async (req, res) => {
    // TODO always validate the api key
    if (req.get('User-Agent').startsWith("ChunkyMap") && !req.get("X-Api-Key")) {
      return res.status(401).send('missing or invalid api key').end()
    }

    if (!req.files) {
      return res.status(400).send('scene files missing').end()
    }

    console.log(`new job from ${req.get('X-Api-Key') || '?'} using ${req.get('User-Agent') || '?'}`) // TODO
    const targetSpp = Math.min(parseInt(req.body.targetSpp || '1000'), 5000)
    const normalTasks = Math.max(0, Math.floor(targetSpp / 100) - 1)
    const lastTask = targetSpp - normalTasks * 100
    const transient = !!req.body.transient
    const texturepack = req.body.texturepack || null
    if (texturepack) {
      if (!supportedTexturepacks.includes(texturepack)) {
        return res.status(400).send('Unsupported texturepack')
      }
    }

    let cachedRegions = {}
    let cachedRegionFiles = {}
    if (req.body.cachedRegions) {
      cachedRegions = JSON.parse(req.body.cachedRegions)
      if (Object.keys(cachedRegions).length > 0) {
        for (const [name,hash] of Object.entries(cachedRegions)) {
          const file = await db.getRegionFile(name, hash)
          if (file != null) {
            cachedRegionFiles[name] = file._id
          }
        }
        const missing = Object.keys(cachedRegions).filter(name => cachedRegionFiles[name] == null)
        if (missing.length > 0) {
          return res.status(400).json({ missing })
        }
      }
    }

    const chunkyVersion = req.body.chunkyVersion || '2.x'
    try {
      let job;
      if (chunkyVersion === '1.x') {
        return res.status(400).send('Only Chunky 2.x is supported for now')

        // TODO bring back Chunky 1.x support
        const { foliage, grass, scene, octree, skymap } = req.files
        if (foliage == null || grass == null || scene == null || octree == null) {
          return res.status(400).send('scene files incomplete').end()
        }
        job = await db.addJob({
          created: new Date(),
          spp: 0,
          targetSpp
        })
        await Promise.all([
          db.addJobFile(job._id, 'foliage', foliage.data).then(({ id }) => id),
          db.addJobFile(job._id, 'grass', grass.data).then(({ id }) => id),
          db.addJobFile(job._id, 'scene', scene.data).then(({ id }) => id),
          db.addJobFile(job._id, 'octree', octree.data).then(({ id }) => id),
          skymap ? db.addJobFile(job._id, 'skymap', skymap.data, skymap.name).then(({ id }) => id) : Promise.resolve(null)
        ])
          .then(([foliageId, grassId, sceneId, octreeId, skymapId]) =>
            db.updateJob(job._id, {
              files: {
                scene: sceneId,
                octree: octreeId,
                foliage: foliageId,
                grass: grassId, skymap: skymapId
              }
            })
          )
      } else if (chunkyVersion === "2.x") {
        const { scene, octree, emittergrid, skymap, region } = req.files
        if (scene == null || (octree == null && region == null && Object.keys(cachedRegionFiles).length === 0)) {
          return res.status(400).send('scene files incomplete').end()
        }
        job = await db.addJob({
          created: new Date(),
          spp: 0,
          targetSpp,
          transient,
          texturepack
        })
        await Promise.all([
          db.addJobFile(job._id, 'scene', scene.data).then(({ id }) => id),
          octree ? db.addJobFile(job._id, 'octree', octree.data).then(({ id }) => id) : Promise.resolve(null),
          emittergrid ? db.addJobFile(job._id, 'emittergrid', emittergrid.data).then(({ id }) => id) : Promise.resolve(null),
          skymap ? db.addJobFile(job._id, 'skymap', skymap.data, skymap.name).then(({ id }) => id) : Promise.resolve(null),
          region ? Promise.all((Array.isArray(region) ? region : [region]).map(r => db.addJobFile(job._id, 'region', r.data, r.name))) : Promise.resolve(null)
        ])
          .then(([sceneId, octreeId, emittergridId, skymapId, regions]) =>
            db.updateJob(job._id, {
              files: {
                scene: sceneId,
                octree: octreeId,
                emittergrid: emittergridId,
                skymap: skymapId,
                regions: octreeId == null ? [...(regions || []).map(({ id, file }) => ({
                  id,
                  name: file.filename
                })), ...Object.entries(cachedRegionFiles).map(([name, id]) => ({
                  id,
                  name
                }))] : null
              }
            })
          )
          
          if (!octree) {
            await queues.addOctreeGeneration(job._id)
          } else {
            try {
              await Promise.all([
                normalTasks > 0 ? queues.addJob(job._id, normalTasks, 100) : Promise.resolve(),
                lastTask > 0 ? queues.addJob(job._id, 1, lastTask) : Promise.resolve()
              ])
            } catch (e) {
              console.log('Could not add the tasks to the queue', e)
              return res.status(500).end()
            }
          }
      } else {
        return res.status(400).send('only Chunky 1.x and 2.x are supported')
      }

      res.status(201).json(job).end()

      try {
        await db.increaseStats({
          jobsCreated: 1
        })
      } catch (e) {
        console.error('Could not save statistics', e)
      }
    } catch (e) {
      console.error('Could not create the job', e)
      res.status(500).end()
    }
  })

  app.post('/jobs/:id/fork', fileUpload(), async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).send('invalid job id').end()
    }
    if (!req.files) {
      return res.status(400).send('scene file missing').end()
    }
    const { scene, skymap } = req.files
    if (scene == null) {
      return res.status(400).send('scene file missing').end()
    }

    const parent = await db.getJobById(req.params.id)
    if (!parent) {
      return res.status(404).send('job not found').end()
    }
    if (parent.transient) {
      return res.status(400).send('cannot fork transient jobs').end()
    }
    try {
      const job = await db.addJob({
        created: new Date(),
        spp: 0,
        targetSpp: 1000
      })
      
      const [sceneId, skymapId] = await Promise.all([
        db.addJobFile(job._id, 'scene', scene.data).then(({ id }) => id),
        skymap ? db.addJobFile(job._id, 'skymap', skymap.data, skymap.name).then(({ id })) : Promise.resolve(null)
      ])
      await db.updateJob(job._id, {
        forkedFrom: parent._id,
        sceneId,
        files: {
          ...parent.files,
          scene: sceneId,
          skymap: skymapId,
        }
      })
            
      await queues.addJob(job._id, 10, 100) // 10 tasks à 100 spp
      res.status(201).json(Object.assign({}, job, { parent: parent._id })).end()

      try {
        await db.increaseStats({
          jobsCreated: 1
        })
      } catch (e) {
        console.error('Could not save statistics', e)
      }
    } catch (e) {
      console.error('Could not create the job', e)
      res.status(500).end()
    }
  })

  app.get('/jobs/:id', (req, res) => {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).send('invalid job id').end()
    }
    db.getJobById(req.params.id)
      .then((job) => {
        if (job) {
          /*job.files = [
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
          ]*/
          const files = job.files
          job.files = [
            {
              type: 'scene',
              url: `/jobs/${job._id}/files/scene.json`
            }
          ]
          if (files.octree) {
            job.files.push({
              type: 'octree',
              url: `/jobs/${job.forkedFrom || job._id}/files/scene.octree2`
            })
          }
          if (files.emittergrid) {
            job.files.push({
              type: 'emittergrid',
              url: `/jobs/${job.forkedFrom || job._id}/files/scene.emittergrid`
            })
          }
          if (files.regions) {
            job.files.push(...files.regions.map(region => ({
              type: 'region',
              name: region.name,
              url: `/files/${region.id}`
            })))
          }
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
    foliage: { name: 'scene.foliage', field: 'foliage' },
    grass: { name: 'scene.grass', field: 'grass' },
    scene: { name: 'scene.json', field: 'scene' },
    octree: { name: 'scene.octree', field: 'octree' },
    octree2: { name: 'scene.octree2', field: 'octree' },
    emittergrid: { name: 'scene.emittergrid', field: 'emittergrid' },
  }
  Object.keys(files).map((type) => {
    app.get(`/jobs/:id/files/${files[type].name}`, async (req, res) => {
      if (!ObjectId.isValid(req.params.id)) {
        return res.status(400).send('invalid job id').end()
      }
      try {
        const job = await db.getJobById(req.params.id)
        if (job) {
          const fileId = job.files[files[type].field]
          if (fileId) {
            const file = await db.getFile(fileId)
            if (file) {
              await serveFile(db.getFileStream, file, res, {
                ifModifiedSince: req.get('If-Modified-Since'),
                contentType: type === 'scene' ? 'application/json' : 'application/octet-stream'
              })
              res.end()
            } else {
              console.error(`Missing ${type} file for ${job.id} (file id ${fileId})`)
              res.status(404).end()
            }
          } else {
            res.status(404).end()
          }
        } else {
          res.status(404).end()
        }
      } catch (e) {
        console.error(e)
        res.status(500).end()
      }
    })
  })

  app.put('/jobs/:id', (req, res) => {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).send('invalid job id').end()
    }
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

  app.get(`/jobs/:id/files/skymap`, async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).send('invalid job id').end()
    }
    try {
      const job = await db.getJobById(req.params.id)
      if (job && job.skymapId) {
        const file = await db.getFile(job.skymapId)
        if (file) {
          res.set('Content-Disposition', `inline; filename="${file.filename}"`)
          res.set('X-Filename', file.filename) // this is used by the render node
          await serveFile(db.getFileStream, file, res, {
            ifModifiedSince: req.get('If-Modified-Since')
          })
          res.end()
        } else {
          console.error(`Missing skymap file for ${job.id} (file id ${job.skymapId})`)
          res.status(404).end()
        }
      } else {
        res.status(404).end()
      }
    } catch (e) {
      console.error(e)
      res.status(500).end()
    }
  })

  app.post(`/jobs/:id/files`, async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).send('invalid job id').end()
    }

    try {
      const busboy = new Busboy({ headers: req.headers })
      let invalid = false

      let octreeId = null
      let emittergridId = null

      await new Promise((resolve, reject) => {
        busboy.on('file', (field, file, filename, encoding, mimetype) => {
          if (field === 'octree') {
            const stream = db.writeJobFile(req.params.id, 'octree')
            stream.on('error', reject)
            file.on('error', reject)
            file.on('end', () => {
              octreeId = stream.id
            })
            file.pipe(stream)
          } else if (field === 'emittergrid') {
            const stream = db.writeJobFile(req.params.id, 'emittergrid')
            stream.on('error', reject)
            file.on('error', reject)
            file.on('end', () => {
              emittergridId = stream.id
            })
            file.pipe(stream)
          } else {
            invalid = true
            console.error('invalid field', field)
            return res.status(400).end('invalid files ' + field)
          }
        })
        busboy.on('finish', resolve)
        busboy.on('error', reject)
        req.pipe(busboy)
      })
      const job = await db.updateJob(req.params.id, {
        $set: {
          'files.octree': octreeId,
          'files.emittergrid': emittergridId
        }
      })
      try {
        // TODO only do this for ChunkyMap jobs (or depending on the resolution)
        const targetSpp = job.targetSpp
        const normalTasks = Math.max(0, Math.floor(targetSpp / 500) - 1)
        const lastTask = targetSpp - normalTasks * 500
        await Promise.all([
          normalTasks > 0 ? queues.addJob(job._id, normalTasks, 500, false) : Promise.resolve(),
          lastTask > 0 ? queues.addJob(job._id, 1, lastTask, false) : Promise.resolve()
        ])
      } catch (e) {
        console.log('Could not add the tasks to the queue', e)
        return res.status(500).end()
      }
      res.status(204).end()
    } catch (e) {
      console.error(e)
      res.status(500).end()
    }
  })

  app.get('/jobs/:id/latest.dump', async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).send('invalid job id').end()
    }
    try {
    const job = await db.getJobById(req.params.id)
      if (job) {
        const file = await db.getLatestDump(req.params.id)
        if (file) {
          res.set('Content-Disposition', `inline; filename="${job.id}.dump"`)
          await serveFile(db.getFileStream, file, res, {
            ifModifiedSince: req.get('If-Modified-Since'),
            contentType: 'application/octet-stream'
          })
          res.end()
        } else {
          res.status(204).end()
        }
      } else {
        res.status(404).end()
      }
    } catch (e) {
      console.error(e)
      res.status(500)
    }
  })

  app.get('/jobs/:id/latest.png', async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).send('invalid job id').end()
    }
    try {
      const file = await db.getLatestPicture(req.params.id)
      if (file) {
        await serveFile(db.getFileStream, file, res, {
          contentType: 'image/png',
          ifModifiedSince: req.get('If-Modified-Since')
        })
        res.end()
      } else {
        res.status(404).end()
      }
    } catch (e) {
      console.error(e)
      res.status(500)
    }
  })

  app.get('/jobs/:id/preview_320.jpg', (req, res) => {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).send('invalid job id').end()
    }
    const filename = `/tmp/${req.params.id}_320.jpg`

    res.sendFile(filename, (err) => {
      if (err) {
        // need to generate thumbnail first
        db.getLatestPicture(req.params.id)
          .then((file) => {
            if (file) {
              const ifModifiedSince = req.get('If-Modified-Since')
              if (ifModifiedSince != null && Date.parse(ifModifiedSince) >= Math.ceil(file.uploadDate.getTime() / 1000)) {
                res.status(304).set({
                  'Content-Type': 'image/jpeg',
                  'Last-Modified': file.uploadDate.toUTCString()
                }).end()
              } else {
                res.set({
                  'Content-Type': 'image/jpeg',
                  'Last-Modified': file.uploadDate.toUTCString()
                })
                const transformer = sharp()
                  .resize(320)
                  .quality(90)
                  .jpeg()
                  .on('error', (err) => {
                    res.status(500).end()
                    console.error(err)
                  })
                const thumbnail = db.getFileStream(file).pipe(transformer)
                thumbnail.pipe(fs.createWriteStream(filename))
                thumbnail.pipe(res)
              }
            } else {
              res.status(404)
            }
          })
          .catch((e) => {
            console.error(e)
            res.status(500)
          })
      }
    })
  })

  app.post('/jobs/:id/latestDump', async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).send('invalid job id').end()
    }
    try {
      const job = await db.getJobById(req.params.id)
      if (!job) {
        return res.status(404).end()
      }

      const busboy = new Busboy({ headers: req.headers })
      let invalid = false
      let dumpInfo
      let dumpUploaded = false
      let pictureUploaded = false

      await new Promise((resolve, reject) => {
        busboy.on('file', (field, file, filename, encoding, mimetype) => {
          if (field === 'dump') {
            const stream = db.writeLatestDump(req.params.id)
            file.on('end', () => dumpUploaded = true)
            stream.on('error', reject)
            file.on('error', reject)
            dumpInfo = getValidatedDumpInfo(file)
            file.pipe(stream)
          } else if (field === 'picture') {
            const stream = db.writeLatestPicture(req.params.id)
            file.on('end', () => pictureUploaded = true)
            stream.on('error', reject)
            file.on('error', reject)
            file.pipe(stream)
          } else {
            invalid = true
            return res.status(400).end('invalid files')
          }
        })
        busboy.on('finish', resolve)
        busboy.on('error', reject)
        req.pipe(busboy)
      })

      if (invalid || !dumpUploaded || !pictureUploaded) {
        throw new Error("Invalid or missing files uploaded")
      }
      try {
        const filename = `/tmp/${req.params.id}_320.jpg`
        await fs.promises.unlink(filename)
      } catch (e) {
      }

      const dump = await dumpInfo
      const finishedNow = job.spp < job.targetSpp && job.targetSpp <= dump.spp
      await db.updateJob(job._id, {
        spp: dump.spp,
        finishedAt: finishedNow ? new Date() : null
      })
      res.status(204).end()

      try {
        if (finishedNow) {
          await db.increaseStats({
            jobsFinished: 1,
            dumpsMerged: 1
          })
        } else {
          await db.increaseStats({
            dumpsMerged: 1
          })
        }
      } catch (e) {
        console.error('Could not save statistics', e)
      }
    } catch (e) {
      console.error(e)
      res.status(500).end()
    }
  })

  app.get('/stats', (req, res) => {
    Promise.all([queues.getStats(), db.getStats()])
      .then(([stats, jobStats]) => res.json(Object.assign({}, stats, jobStats)).end())
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
        return `/badge/RS%20render%20nodes-${renderNodes.length}-${color}.svg`
      })
      .catch((e) => {
        console.error(e)
        res.status(500).end()
      }),
    intercept: (rsp, data, req, res, callback) => {
      res.set('cache-control', 'max-age=300')
      callback(null, data)
    }
  }))

  app.get('/files/:id', async (req, res) => {
    try {
      const file = await db.getFile(req.params.id)
      if (file) {
        res.set('Content-Disposition', `inline; filename="${file.filename}"`)
        if (file.metadata.type === 'region') {
          res.set('Cache-Control', 'public, max-age=31557600')
        }
        await serveFile(db.getFileStream, file, res, {
          ifModifiedSince: req.get('If-Modified-Since')
        })
        res.end()
      } else {
        res.status(404).end()
      }
    } catch (e) {
      console.error(e)
      res.status(500).end()
    }
  })
}
