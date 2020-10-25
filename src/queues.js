const amqp = require('amqplib')
const rp = require('request-promise')

function getTaskQueue() {
  return amqp.connect(process.env.RABBITMQ_URL)
    .then((conn) => conn.createConfirmChannel()
      .then((ch) =>
        ch.assertQueue('rs_tasks', { durable: true, maxPriority: 5 })
          .then(() => ({ conn, ch, queue: 'rs_tasks' }))
      )
    )
}

function getPrepareQueue() {
  return amqp.connect(process.env.RABBITMQ_URL)
    .then((conn) => conn.createConfirmChannel()
      .then((ch) =>
        ch.assertQueue('rs_prepare', { durable: true, maxPriority: 5 })
          .then(() => ({ conn, ch, queue: 'rs_prepare' }))
      )
    )
}

function addJob(jobId, tasks, sppPerTask, preferFirstTask = true) {
  const taskConfig = JSON.stringify({
    jobId: jobId,
    spp: sppPerTask
  })

  return getTaskQueue()
    .then(({ conn, ch, queue }) => {
      if (preferFirstTask) {
        ch.sendToQueue(queue, new Buffer(taskConfig), { priority: 3, persistent: true }) // higher priority for the first task
        for (let i = 1; i < tasks; i++) {
          ch.sendToQueue(queue, new Buffer(taskConfig), { persistent: true })
        }
      } else {
        for (let i = 0; i < tasks; i++) {
          ch.sendToQueue(queue, new Buffer(taskConfig), { persistent: true })
        }
      }
      ch.close().then(() => conn.close())
    })
}

function addOctreeGeneration(jobId) {
  const taskConfig = JSON.stringify({
    jobId: jobId
  })

  return getPrepareQueue()
    .then(({ conn, ch, queue }) => {
      ch.sendToQueue(queue, new Buffer(taskConfig), { priority: 3, persistent: true })
      ch.close().then(() => conn.close())
    })
}

function getStats() {
  return Promise.all([
    rp(process.env.RABBITMQ_API_URL + '/connections'),
    rp(process.env.RABBITMQ_API_URL + '/queues/renderservice/rs_tasks'),
    rp(process.env.RABBITMQ_API_URL + '/queues/renderservice/rs_dumps'),
    rp(process.env.RABBITMQ_API_URL + '/queues/renderservice/rs_prepare'),
  ])
    .then((responses) => responses.map((r) => JSON.parse(r)))
    .then(([connections, tasks, dumps, prepareTasks]) => {
      const connectionsMap = []
      connections.forEach((con) => {
        connectionsMap[con.name] = con
      })

      return {
        tasks: {
          preparePending: prepareTasks.messages_ready,
          prepareRunning: prepareTasks.messages_unacknowledged,
          pending: tasks.messages_ready,
          running: tasks.messages_unacknowledged,
          unmerged: dumps.messages_ready + dumps.messages_unacknowledged
        },
        renderNodes: tasks.consumer_details.map((consumer) => {
          const clientProperties = connectionsMap[consumer.channel_details.connection_name].client_properties
          return {
            account: clientProperties['x-rs-account'],
            name: clientProperties['x-rs-name'],
            threads: clientProperties['x-rs-threads']
          }
        }),
        prepareNodes: prepareTasks.consumer_details.map((consumer) => {
          const clientProperties = connectionsMap[consumer.channel_details.connection_name].client_properties
          return {
            account: clientProperties['x-rs-account'],
            name: clientProperties['x-rs-name'],
            threads: clientProperties['x-rs-threads']
          }
        })
      }
    })
}

module.exports = {
  getTaskQueue,
  addJob,
  addOctreeGeneration,
  getStats
}
