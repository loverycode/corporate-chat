export interface EventsPublisher {
  publishToChannel(channelId: string, event: string, payload: unknown): void;
  publishToUser(userId: string, event: string, payload: unknown): void;
  publishToAll(event: string, payload: unknown): void;
}
export const EVENTS_PUBLICHER = Symbol('EVENTS_PUBLICHER');
