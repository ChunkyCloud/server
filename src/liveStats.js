const WebSocketServer = require('ws').Server
const { getStats } = require('./queues')

module.exports = (server) => {
  const wss = new WebSocketServer({ server, path: '/stats/live' })

  setInterval(() => {
    getStats()
    .then((stats) => {
      wss.clients.forEach((client) => {
        client.send(JSON.stringify(stats))
      })
    })
    .catch((e) => {
      console.error(e)
    })
  }, 5000)
}
