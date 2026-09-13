import { Injectable } from '@nestjs/common';

@Injectable()
export class JobsBus {
  private subscribers = new Set<Handler>();

  subscribe(listener: Handler) {
    this.subscribers.add(listener);
    return {
      remove: () => {
        this.remove(listener);
      },
    };
  }

  publish(data: JobsBusEvent) {
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

export class JobMergeStartedEvent {
  constructor(public readonly jobId: number) {}
}

export class RenderTasksAvailableEvent {}

export type JobsBusEvent =
  | JobStartedEvent
  | JobMergeStartedEvent
  | RenderTasksAvailableEvent;

type Handler = (event: JobsBusEvent) => void;
