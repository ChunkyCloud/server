const amqp = require('amqplib')

const RABBITMQ_ADDRESS = process.env.RABBITMQ_URL

function getTaskQueue () {
  return amqp.connect(RABBITMQ_ADDRESS)
    .then((conn) => conn.createConfirmChannel()
      .then((ch) =>
        ch.assertQueue('rs_tasks', { durable: true, maxPriority: 5 })
          .then(() => ({ conn, ch, queue: 'rs_tasks' }))
      )
    )
}

/*
function getInitQueue () {
  return amqp.connect(RABBIT_MQ_ADDRESS)
    .then((conn) => conn.createConfirmChannel()
      .then((ch) =>
        ch.assertQueue('rs_init_tasks', { durable: true, maxPriority: 5 })
          .then(() => ({ conn, ch, queue: 'rs_init_tasks' }))
      )
    )
}
*/

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

module.exports = {
  getTaskQueue: getTaskQueue,
  addJob: addJob
}
