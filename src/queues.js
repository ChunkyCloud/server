const amqp = require('amqplib')
const rp = require('request-promise')

function getTaskQueue () {
  return amqp.connect(process.env.RABBITMQ_URL)
    .then((conn) => conn.createConfirmChannel()
      .then((ch) =>
        ch.assertQueue('rs_tasks', { durable: true, maxPriority: 5 })
          .then(() => ({ conn, ch, queue: 'rs_tasks' }))
      )
    )
}

function addJob (jobId, tasks, sppPerTask) {
  const taskConfig = JSON.stringify({
    jobId: jobId,
    spp: sppPerTask
  })

  return getTaskQueue()
    .then(({ conn, ch, queue }) => {
      ch.sendToQueue(queue, new Buffer(taskConfig), { priority: 3, persistent: true }) // higher priority for the first task
      for (let i = 1; i < tasks; i++) {
        ch.sendToQueue(queue, new Buffer(taskConfig), { persistent: true })
      }
      ch.close().then(() => conn.close())
    })
}

function getStats () {
  return Promise.all([
      rp(process.env.RABBITMQ_API_URL + '/queues/renderservice/rs_tasks'),
      rp(process.env.RABBITMQ_API_URL + '/queues/renderservice/rs_dumps')
    ])
    .then((responses) => responses.map((r) => JSON.parse(r)))
    .then(([ tasks, dumps ]) => ({
      tasks: {
        pending: tasks.messages_ready,
        running: tasks.messages_unacknowledged,
        unmerged: dumps.messages_ready
      },
      renderNodes: tasks.consumer_details.length
    }))
}

module.exports = {
  getTaskQueue,
  addJob,
  getStats
}
