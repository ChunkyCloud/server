const path = require('path')
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

module.exports = (app, config) => {
  app.post('/jobs', (req, res) => {
    if (!req.files) {
      return res.status(400).send('scene files missing')
    }
    const { foliage, grass, scene, octree } = req.files
    if (foliage == null || grass == null || scene == null || octree == null) {
      return res.status(400).send('scene files incomplete')
    }

    const sceneDir = config.sceneDir

    Promise.all([
      moveFile(foliage, path.join(sceneDir, 'scene.foliage')),
      moveFile(grass, path.join(sceneDir, 'scene.grass')),
      moveFile(scene, path.join(sceneDir, 'scene.json')),
      moveFile(octree, path.join(sceneDir, 'scene.octree'))
    ])
    .then(() => {
      // TODO put the job into the database
      const job = { _id: 'someJob' }
      queues.addJob(job._id, 10, 100) // 10 tasks à 100 spp
      .then(() => res.status(204).end())
      .catch((e) => {
        console.log('Could not add the tasks to the queue')
        res.status(500).end()
      })
    })
    .catch((e) => {
      console.error('Could not save scene files', e)
      res.status(500).end()
    })
  })
}
