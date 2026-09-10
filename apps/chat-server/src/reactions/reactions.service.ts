import {Injectable, NotFoundException, ForbiddenException} from '@nestjs/common';
import { MessagesGateway } from '../messages/messages.gateway';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: MessagesGateway,
  ) {}
  private async assertMember(channelId: string, userId: string) {
    const membership = await this.prisma.channelMembers.findUnique({
      where: { channelId_userId: { channelId, userId } },
    });
    if (!membership) {
      throw new ForbiddenException('not a member of a channel');
    }
  }
  async addReaction(messageId: string, userId: string, emoji: string) {
    const message = await this.prisma.messages.findUnique({
      where: { id: messageId },
    });
    if (!message || message.deletedAt) {
      throw new NotFoundException('message not found');
    }
    await this.assertMember(message.channelId, userId);

    await this.prisma.reactions.upsert({
      where: { messageId_userId_emoji: { messageId, userId, emoji } },
      update: {},
      create: { messageId, userId, emoji },
    });

    const reactions = await this.prisma.reactions.findMany({
      where: { messageId },
    });
    this.gateway.emitReactionChanged(message.channelId, messageId, reactions);

    return { ok: true };
  }

  async removeReaction(messageId: string, userId: string, emoji: string) {
    const message = await this.prisma.messages.findUnique({
      where: { id: messageId },
    });
    if (!message) {
      throw new NotFoundException('message not found');
    }
    await this.assertMember(message.channelId, userId);
    if (message.deletedAt) {
      throw new NotFoundException('message not found');
    }
    await this.prisma.reactions.deleteMany({
      where: { messageId, userId, emoji },
    });

    const reactions = await this.prisma.reactions.findMany({
      where: { messageId },
    });
    this.gateway.emitReactionChanged(message.channelId, messageId, reactions);

    return { ok: true };
  }
}
