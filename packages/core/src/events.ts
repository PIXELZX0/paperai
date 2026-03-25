import { EventEmitter } from "node:events";

export interface DomainEvent<T = Record<string, unknown>> {
  type: string;
  payload: T;
  at: string;
}

export class DomainEventBus {
  private readonly emitter = new EventEmitter();

  publish<T>(type: string, payload: T): DomainEvent<T> {
    const event = { type, payload, at: new Date().toISOString() };
    this.emitter.emit("event", event);
    return event;
  }

  subscribe(listener: (event: DomainEvent) => void): () => void {
    this.emitter.on("event", listener);
    return () => this.emitter.off("event", listener);
  }
}
