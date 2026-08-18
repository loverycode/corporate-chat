import {WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage,
        MessageBody, ConnectedSocket} from '@nestjs/websockets';
import {Server, Socket} from 'socket.io';
import {Logger} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';


@WebSocketGateway({cors: {origin: '*'}})
export class MessagesGateway implements OnGatewayConnection, OnGatewayDisconnect{
    @WebSocketServer()
    server: Server;

    private readonly logger =  new Logger(MessagesGateway.name);
    constructor(private readonly prisma: PrismaService,
                private readonly jwtService: JwtService,
    ){}

    async handleConnection(client: Socket) {
        const token = client.handshake.auth?.token as string || undefined;
        if (!token) {
            this.logger.warn(`Connection rejected: no token (${client.id})`);
            client.disconnect();
            return;
        }
        try{
            const payload = this.jwtService.verify(token, {secret: process.env.JWT_SECRET});
            client.data.userId=payload.sub;
            client.join(`user:${payload.sub}`);

            const memberships = await this.prisma.channelMembers.findMany({
                where:{userId: payload.sub},
                select:{channelId: true},
            });
            for (const membership of memberships){
                client.join(membership.channelId)
            }
            this.logger.log(`User ${payload.sub} connected, joined ${memberships.length} channels`);
        }catch(error){
            this.logger.warn(`Connection rejected: invalid token (${client.id})`);
            client.disconnect();
        }
    }
    handleDisconnect(client: Socket) {
        this.logger.log(`Client disconnected: ${client.id}`);
    }
    @SubscribeMessage('typing')
    handleTyping(
        @MessageBody() data: { channelId: string },
        @ConnectedSocket() client: Socket,
    ) {
        const userId = client.data.userId;
        if (!userId || !data?.channelId) return;

        client.to(data.channelId).emit('typing', {
            channelId: data.channelId,
            userId,
        });
    }
    emitMessageCreated(channelId: string, message: unknown) {
        this.server.to(channelId).emit('message.created', message);
    }
    emitUnreadChanged(userId:string, total: number, channelId: string, count: number){
        this.server.to(`user:${userId}`).emit('unread.changed', { total, channelId, count });
    }
    emitMessageUpdated(channelId: string, message: unknown) {
        this.server.to(channelId).emit('message.updated',message);
    }
    emitMessageDeleted(channelId: string, messageId: string) {
        this.server.to(channelId).emit('message.deleted', {id:messageId, channelId});
    }
    emitReactionChanged(channelId: string, messageId: string, reactions: { userId: string; emoji: string }[]) {
        this.server.to(channelId).emit('reaction.changed', { messageId, reactions });
    }
}