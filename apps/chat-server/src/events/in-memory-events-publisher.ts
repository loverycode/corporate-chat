import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import { EventsPublisher } from './events-publisher.interface';
@Injectable()
export class InMemoryEventsPublisher implements EventsPublisher {
  private server: Server | null = null;
  setServer(server: Server) {
    this.server = server;
  }
  publishToChannel(channelId: string, event: string, payload: unknown): void {
    this.server?.to(channelId).emit(event, payload);
  }
  publishToUser(userId: string, event: string, payload: unknown): void {
    this.server?.to(`user:${userId}`).emit(event, payload);
  }
  publishToAll(event: string, payload: unknown): void {
    this.server?.emit(event, payload);
  }
  joinRoom(userId: string, channelId: string): void {
    this.server?.in(`user:${userId}`).socketsJoin(channelId);
  }
  leaveRoom(userId: string, channelId: string): void {
    this.server?.in(`user:${userId}`).socketsLeave(channelId);
  }
}
