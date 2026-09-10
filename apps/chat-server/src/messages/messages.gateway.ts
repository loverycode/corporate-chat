import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { InMemoryEventsPublisher } from '../events/in-memory-events-publisher';
import { getAllowedOrigins } from '../config/allowed-origins';
import { EventsPublisher } from '../events/events-publisher.interface';

interface AuthenticatedSocket extends Socket {
  data: { userId: string };
}
interface JwtPayload {
  sub: string;
  name: string;
  email: string;
  role: string;
}

@Injectable()
@WebSocketGateway({ cors: { origin: getAllowedOrigins() } })
export class MessagesGateway
  implements OnGatewayConnection, OnGatewayDisconnect, EventsPublisher
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MessagesGateway.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly eventsPublisher: InMemoryEventsPublisher,
  ) {}
  private onlineUsers = new Map<string, number>();

  async handleConnection(client: AuthenticatedSocket) {
    const token = (client.handshake.auth?.token as string) || undefined;
    if (!token) {
      this.logger.warn(`Connection rejected: no token (${client.id})`);
      client.disconnect();
      return;
    }
    try {
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: process.env.CHAT_JWT_SECRET,
      });
      client.data.userId = payload.sub;
      await client.join(`user:${payload.sub}`);

      const memberships = await this.prisma.channelMembers.findMany({
        where: { userId: payload.sub },
        select: { channelId: true },
      });
      for (const membership of memberships) {
        await client.join(membership.channelId);
      }
      this.markOnline(payload.sub);
      this.logger.log(
        `User ${payload.sub} connected, joined ${memberships.length} channels`,
      );
      this.eventsPublisher.setServer(this.server);
    } catch {
      this.logger.warn(`Connection rejected: invalid token (${client.id})`);
      client.disconnect();
    }
  }
  handleDisconnect(client: AuthenticatedSocket) {
    const userId = client.data.userId;
    if (userId) {
      this.markOffline(userId);
    }
  }

  private markOnline(userId: string) {
    const count = this.onlineUsers.get(userId) ?? 0;
    this.onlineUsers.set(userId, count + 1);
    if (count === 0) {
      this.eventsPublisher.publishToAll('presence.changed', {
        userId,
        online: true,
      });
    }
  }

  private markOffline(userId: string) {
    const count = this.onlineUsers.get(userId) ?? 0;
    if (count <= 1) {
      this.onlineUsers.delete(userId);
      this.eventsPublisher.publishToAll('presence.changed', {
        userId,
        online: false,
      });
    } else {
      this.onlineUsers.set(userId, count - 1);
    }
  }

  isOnline(userId: string): boolean {
    return this.onlineUsers.has(userId);
  }
  getOnlineUserIds(): string[] {
    return Array.from(this.onlineUsers.keys());
  }

  @SubscribeMessage('typing')
  async handleTyping(
    @MessageBody() data: { channelId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const userId = client.data.userId;
    if (!userId || !data?.channelId) return;

    const membership = await this.prisma.channelMembers.findUnique({
      where: { channelId_userId: { channelId: data.channelId, userId } },
    });
    if (!membership) return;

    client
      .to(data.channelId)
      .emit('typing', { channelId: data.channelId, userId });
  }
  emitMessageCreated(channelId: string, message: unknown) {
    this.eventsPublisher.publishToChannel(channelId, 'message.created', message);
  }
  emitUnreadChanged(userId: string, total: number, channelId: string, count: number,) {
    this.eventsPublisher.publishToUser(userId, 'unread.changed', {channelId, total, count});
  }
  emitMessageUpdated(channelId: string, message: unknown) {
    this.eventsPublisher.publishToChannel(channelId, 'message.updated', message);
  }
  emitMessageDeleted(channelId: string, messageId: string) {
    this.eventsPublisher.publishToChannel(channelId, 'message.deleted', messageId);
  }
  emitReactionChanged(channelId: string, messageId: string, reactions: { userId: string; emoji: string }[]) {
    this.eventsPublisher.publishToChannel(channelId, 'reaction.changed', {messageId, reactions});
  }
  emitToUser(userId: string, event: string, data: any){
    this.server.to(`user:${userId}`).emit(event, data);
  }
   publishToChannel(channelId: string, event: string, payload: unknown): void {
    this.eventsPublisher.publishToChannel(channelId, event, payload);
  }

  publishToUser(userId: string, event: string, payload: unknown): void {
    this.server.to(`user:${userId}`).emit(event, payload);
  }

  publishToAll(event: string, payload: unknown): void {
    this.server.emit(event, payload);
  }
  joinRoom(userId: string, channelId: string): void {
    this.server.in(`user:${userId}`).socketsJoin(channelId);
  }

  leaveRoom(userId: string, channelId: string): void {
    this.server.in(`user:${userId}`).socketsLeave(channelId);
  }
}
