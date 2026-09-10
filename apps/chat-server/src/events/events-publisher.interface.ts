export interface EventsPublisher {
  publishToChannel(channelId: string, event: string, payload: unknown): void;
  publishToUser(userId: string, event: string, payload: unknown): void;
  publishToAll(event: string, payload: unknown): void;
  joinRoom(userId: string, channelId: string): void; 
  leaveRoom(userId: string, channelId: string): void;
}
export const EVENTS_PUBLISHER = Symbol('EVENTS_PUBLISHER');
