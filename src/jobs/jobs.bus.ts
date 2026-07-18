import { Injectable } from '@nestjs/common';

type Handler = (event: JobStartedEvent) => void;

@Injectable()
export class JobsBus {
  private subscribers = new Set<Handler>();

  subscribe(listener: Handler) {
    this.subscribers.add(listener);
  }

  publish(data: JobStartedEvent) {
    for (const resolve of this.subscribers) {
      resolve(data);
    }
    this.subscribers.clear();
  }

  remove(resolve: Handler) {
    this.subscribers.delete(resolve);
  }
}

export class JobStartedEvent {
  constructor(public readonly jobId: number) {}
}
