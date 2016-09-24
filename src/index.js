const express = require('express')
var bodyParser = require('body-parser')
const fileUpload = require('express-fileupload')

const app = express()
app.use(bodyParser.json({ extended: true, limit: '5mb' }))
app.use(fileUpload())

require('./api')(app, {
  sceneDir: '/tmp'
})
app.listen(process.env.PORT || 3000)
