const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const dotenv = require('dotenv')
dotenv.config()

const app = express()
app.use(cors())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json({ extended: true, limit: '50mb' }))

require('./database')(process.env.MONGO_URL || 'mongodb://localhost:27017/rs')
  .then((db) => {
    require('./api')(app, db, {
      sceneDir: '/tmp',
      publicRabbitMqUri: process.env.PUBLIC_RABBITMQ_URL
    })
    const server = app.listen(process.env.PORT || 3000)
    require('./liveStats')(server)
    console.log('Running')
  })
  .catch((e) => {
    console.error('Could not connect to the database', e)
  })
