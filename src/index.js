const express = require('express')
var bodyParser = require('body-parser')
const fileUpload = require('express-fileupload')

const app = express()
app.use(bodyParser.json({ extended: true, limit: '5mb' }))
app.use(fileUpload())

require('./database')('mongodb://localhost:27017/renderservice')
.then((db) => {
  require('./api')(app, db, {
    sceneDir: '/tmp'
  })
  app.listen(process.env.PORT || 3000)
  console.log('Running')
})
.catch((e) => {
  console.error('Could not connect to the database', e)
})
