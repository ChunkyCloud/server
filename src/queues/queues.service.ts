import { Injectable, Logger } from '@nestjs/common';
import * as amqp from 'amqplib';
import fetch from 'node-fetch';

export const TASK_QUEUE = 'rs_tasks_241';
export const PREPARE_QUEUE = 'rs_prepare_241';
export const DUMP_QUEUE = 'rs_dumps';

@Injectable()
export class QueuesService {
  private readonly rabbitmqUrl: string = process.env.RABBITMQ_URL;
  private readonly rabbitmqApiUrl: string = process.env.RABBITMQ_API_URL;
  private readonly logger = new Logger('QueuesService');

  async addJob(
    jobId: string,
    tasks: number,
    sppPerTask: number,
    priority = 3,
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
          priority: preferFirstTask ? priority + 1 : priority,
          persistent: true,
        });
        for (let i = 1; i < tasks; i++) {
          channel.sendToQueue(TASK_QUEUE, taskConfig, {
            persistent: true,
            priority,
          });
        }
      } else {
        for (let i = 0; i < tasks; i++) {
          channel.sendToQueue(TASK_QUEUE, taskConfig, {
            persistent: true,
            priority,
          });
        }
      }
    } finally {
      await channel.close();
      await connection.close();
    }
  }

  async addDump(jobId: string, dumpFileId: string, priority = 1) {
    const { connection, channel } = await this.createChannel();
    try {
      // the buffer is compatible with Java's DataInputStream (strings can be read with readUTF)
      const versionBuffer = Buffer.from('v2');
      const jobIdBuffer = Buffer.from(jobId);
      const dumpFileIdBuffer = Buffer.from(dumpFileId);
      const uint16be = (x: number) => {
        const b = Buffer.alloc(2);
        b.writeUInt16BE(x, 0);
        return b;
      };
      channel.sendToQueue(
        DUMP_QUEUE,
        Buffer.concat([
          uint16be(versionBuffer.length),
          versionBuffer,
          uint16be(jobIdBuffer.length),
          jobIdBuffer,
          uint16be(dumpFileIdBuffer.length),
          dumpFileIdBuffer,
        ]),
        {
          persistent: true,
          priority,
        },
      );
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
        `${this.rabbitmqApiUrl}/queues/renderservice/${TASK_QUEUE}`,
      ).then((res) => res.json()),
      fetch(
        `${this.rabbitmqApiUrl}/queues/renderservice/${DUMP_QUEUE}`,
      ).then((res) => res.json()),
      fetch(
        `${this.rabbitmqApiUrl}/queues/renderservice/${PREPARE_QUEUE}`,
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
            version: clientProperties['x-version'],
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
            version: clientProperties['x-version'],
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
    connection.on('error', (err) => {
      this.logger.error('AMQP connection error', err);
    });
    const channel = await connection.createConfirmChannel();
    channel.on('error', (err) => {
      this.logger.error('AMQP channel error', err);
    });
    return { connection, channel };
  }
}
