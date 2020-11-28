import { Injectable } from '@nestjs/common';
import * as amqp from 'amqplib';
import fetch from 'node-fetch';

const TASK_QUEUE = 'rs_tasks';
const PREPARE_QUEUE = 'rs_prepare';

@Injectable()
export class QueuesService {
  private readonly rabbitmqUrl: string = process.env.RABBITMQ_URL;
  private readonly rabbitmqApiUrl: string = process.env.RABBITMQ_API_URL;

  async addJob(
    jobId: string,
    tasks: number,
    sppPerTask: number,
    preferFirstTask = true,
  ) {
    if (tasks < 1 || sppPerTask < 1) return;

    const { connection, channel } = await this.createChannel();
    try {
      const taskConfig = Buffer.from(
        JSON.stringify({
          jobId: jobId,
          spp: sppPerTask,
        }),
      );
      if (preferFirstTask) {
        // higher priority for the first task
        channel.sendToQueue(TASK_QUEUE, taskConfig, {
          priority: 3,
          persistent: true,
        });
        for (let i = 1; i < tasks; i++) {
          channel.sendToQueue(TASK_QUEUE, taskConfig, { persistent: true });
        }
      } else {
        for (let i = 0; i < tasks; i++) {
          channel.sendToQueue(TASK_QUEUE, taskConfig, { persistent: true });
        }
      }
    } finally {
      await channel.close();
      await connection.close();
    }
  }

  async addOctreeGeneration(jobId: string) {
    const { connection, channel } = await this.createChannel();
    try {
      channel.sendToQueue(
        PREPARE_QUEUE,
        Buffer.from(JSON.stringify({ jobId })),
        { persistent: true },
      );
    } finally {
      await channel.close();
      await connection.close();
    }
  }

  async getStats() {
    const [
      connections,
      channels,
      tasks,
      dumps,
      prepareTasks,
    ] = await Promise.all([
      fetch(`${this.rabbitmqApiUrl}/connections`).then((res) => res.json()),
      fetch(`${this.rabbitmqApiUrl}/channels`).then((res) => res.json()),
      fetch(
        `${this.rabbitmqApiUrl}/queues/renderservice/rs_tasks`,
      ).then((res) => res.json()),
      fetch(
        `${this.rabbitmqApiUrl}/queues/renderservice/rs_dumps`,
      ).then((res) => res.json()),
      fetch(
        `${this.rabbitmqApiUrl}/queues/renderservice/rs_prepare`,
      ).then((res) => res.json()),
    ]);

    const connectionsMap: {
      [name: string]: {
        channel?: {
          messages_unacknowledged: number;
        };
        client_properties: {
          [key: string]: string | number;
        };
      };
    } = {};
    connections.forEach((con) => {
      connectionsMap[con.name] = con;
      connectionsMap[con.name].channel = channels.find(
        (c) => c.connection_details.name === con.name,
      );
    });

    return {
      tasks: {
        preparePending: prepareTasks.messages_ready,
        prepareRunning: prepareTasks.messages_unacknowledged,
        pending: tasks.messages_ready,
        running: tasks.messages_unacknowledged,
        mergePending: dumps.messages_ready,
        mergeRunning: dumps.messages_unacknowledged,
      },
      renderNodes: tasks.consumer_details
        .map((consumer) => {
          const connection =
            connectionsMap[consumer.channel_details.connection_name];
          if (!connection) return null;
          const clientProperties = connection.client_properties;
          return {
            account: clientProperties['x-rs-account'],
            name: clientProperties['x-rs-name'],
            threads: clientProperties['x-rs-threads'],
            status:
              connection.channel == null ||
              connection.channel.messages_unacknowledged === 0
                ? 'idle'
                : 'working',
          };
        })
        .filter((n) => n != null),
      prepareNodes: prepareTasks.consumer_details
        .map((consumer) => {
          const connection =
            connectionsMap[consumer.channel_details.connection_name];
          if (!connection) return null;
          const clientProperties = connection.client_properties;
          return {
            account: clientProperties['x-rs-account'],
            name: clientProperties['x-rs-name'],
            threads: clientProperties['x-rs-threads'],
            status:
              connection.channel == null ||
              connection.channel.messages_unacknowledged === 0
                ? 'idle'
                : 'working',
          };
        })
        .filter((n) => n != null),
    };
  }

  private async createChannel() {
    // TODO re-use one channel instead of reconnecting all the time?
    const connection = await amqp.connect(this.rabbitmqUrl);
    const channel = await connection.createConfirmChannel();
    return { connection, channel };
  }
}
