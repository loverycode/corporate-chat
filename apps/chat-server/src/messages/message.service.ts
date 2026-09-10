import {PrismaService} from '../prisma/prisma.service';
import {CreateMessageDto} from './create-message.dto';
import {ForbiddenException, Injectable, NotFoundException, BadRequestException} from '@nestjs/common';
import { MessagesGateway } from './messages.gateway';
import { ObjectsService } from '../objects/objects.service';
import { UpdateMessageDto } from './update-message.dto';

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: MessagesGateway,
    private readonly objectsService: ObjectsService,
  ) {}
  private async assertMember(channelId: string, userId: string) {
    const membership = await this.prisma.channelMembers.findUnique({
      where: { channelId_userId: { channelId, userId } },
    });
    if (!membership) {
      throw new ForbiddenException('not a member of a channel');
    }
  }

  private extractMentionedUserIds(bodyMd: string): string[] {
    const ids = new Set<string>();
    const pattern = /<@([0-9a-fA-F-]{36})>/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(bodyMd)) !== null) {
      ids.add(match[1]);
    }
    return Array.from(ids);
  }

  async create(channelId: string, dto: CreateMessageDto, authorId: string) {
    await this.assertMember(channelId, authorId);
    const bodyMd = dto.bodyMd?.trim() ?? '';
    if (!bodyMd && (!dto.attachmentIds || dto.attachmentIds.length === 0)) {
      throw new BadRequestException('Message must contain text or at least one attachment');
    }
    if (dto.attachmentIds && dto.attachmentIds.length > 10) {
        throw new BadRequestException('Maximum 10 attachments per message');
    }
    const existing = await this.prisma.messages.findUnique({
      where: {
        channelId_clientMessageId: {
          channelId,
          clientMessageId: dto.clientMessageId,
        },
      },
    });
    if (existing) {
      return existing;
    }
    if (dto.replyToId) {
      const original = await this.prisma.messages.findUnique({
        where: { id: dto.replyToId },
      });
      if (!original || original.channelId !== channelId) {
        throw new NotFoundException('reply target not found in this channel');
      }
    }
    const message = await this.prisma.messages.create({
      data: {
        channelId,
        authorId,
        bodyMd,
        replyToId: dto.replyToId,
        clientMessageId: dto.clientMessageId,
      },
    });
    const objectIds = this.objectsService.extractObjectIds(bodyMd);
    if (objectIds.length > 0) {
      const resolved = await this.objectsService.resolveObjects(
        objectIds,
        authorId,
      );
      for (const id of objectIds) {
        const obj = resolved.get(id);
        if (
          obj?.exists &&
          obj.canRead &&
          obj.title &&
          obj.typeName &&
          obj.icon
        ) {
          await this.prisma.objectRefs.create({
            data: {
              messageId: message.id,
              objectId: id,
              snapshotTitle: obj.title,
              snapshotTypeName: obj.typeName,
              snapshotIcon: obj.icon,
            },
          });
        }
      }
    }

    const mentionedIds = this.extractMentionedUserIds(dto.bodyMd);
    if (mentionedIds.length > 0) {
      const members = await this.prisma.channelMembers.findMany({
        where: { channelId, userId: { in: mentionedIds } },
        select: { userId: true },
      });
      const validMemberIds = new Set(members.map((m) => m.userId));

      for (const userId of mentionedIds) {
        if (validMemberIds.has(userId)) {
          await this.prisma.mentions.create({
            data: { messageId: message.id, mentionedUserId: userId },
          });
        }
      }
    }
    if (dto.attachmentIds && dto.attachmentIds.length > 0) {
      const attachments = await this.prisma.attachments.findMany({
        where: {
          id: { in: dto.attachmentIds },
          uploaderId: authorId,
          messageId: null,
          channelId: channelId,
        },
      });

      if (attachments.length !== dto.attachmentIds.length) {
        throw new BadRequestException('Some attachments are invalid or from other channels');
      }
      await this.prisma.attachments.updateMany({
        where: {
          id: { in: dto.attachmentIds },
          uploaderId: authorId,
          messageId: null,
        },
        data: { messageId: message.id },
      });
    }

    const messageWithRelations = await this.prisma.messages.findUnique({
      where: { id: message.id },
      include: {
        refs: true,
        mentions: true,
        files: true,
        reactions: true,
        replyTo: {
          select: { id: true, bodyMd: true, authorId: true, deletedAt: true },
        },
      },
    });

    this.gateway.emitMessageCreated(channelId, messageWithRelations);
    await this.notifyUnreadChanged(channelId, authorId);
    return messageWithRelations;
  }

  private async notifyUnreadChanged(channelId: string, authorId: string) {
    const otherMembers = await this.prisma.channelMembers.findMany({
      where: { channelId, userId: { not: authorId } },
      select: { userId: true },
    });
    if (otherMembers && otherMembers.length > 0) {
      await Promise.all(
        otherMembers.map(async ({ userId }) => {
          const memberships = await this.prisma.channelMembers.findMany({
            where: { userId },
            select: { channelId: true, lastReadMessageId: true },
          });

          let total = 0;
          let countForChannel = 0;
          for (const membership of memberships) {
            const count = await this.prisma.messages.count({
              where: {
                channelId: membership.channelId,
                deletedAt: null,
                ...(membership.lastReadMessageId
                  ? {
                      createdAt: {
                        gt: await this.getMessageCreatedAt(
                          membership.lastReadMessageId,
                        ),
                      },
                    }
                  : {}),
              },
            });
            total += count;
            if (membership.channelId === channelId) {
              countForChannel = count;
            }
          }

          this.gateway.emitUnreadChanged(userId, total, channelId, countForChannel);
        }),
      );
    }
  }

  private async getMessageCreatedAt(messageId: string): Promise<Date> {
    const message = await this.prisma.messages.findUnique({
      where: { id: messageId },
      select: { createdAt: true },
    });
    return message?.createdAt ?? new Date(0);
  }

  async update(messageId: string, dto: UpdateMessageDto, userId: string) {
    const message = await this.prisma.messages.findUnique({
      where: { id: messageId },
    });
    if (!message || message.deletedAt) {
      throw new NotFoundException('message not found');
    }
    if (message.authorId !== userId) {
      throw new ForbiddenException('cannot edit a message you did not author');
    }
    const updated = await this.prisma.messages.update({
      where: { id: messageId },
      data: { bodyMd: dto.bodyMd, editedAt: new Date() },
      include: { refs: true, mentions: true, files: true, reactions: true },
    });
    this.gateway.emitMessageUpdated(message.channelId, updated);
    return updated;
  }

  async remove(messageId: string, userId: string) {
    const message = await this.prisma.messages.findUnique({
      where: { id: messageId },
    });
    if (!message || message.deletedAt) {
      throw new NotFoundException('message not found');
    }
    if (message.authorId !== userId) {
      throw new ForbiddenException('cannot edit a message you did not author');
    }
    await this.prisma.messages.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
    });
    this.gateway.emitMessageDeleted(message.channelId, messageId);
    return { ok: true };
  }

  async findHistory(channelId: string, userId: string, cursor?: string, limit = 30) {
    await this.assertMember(channelId, userId);
    const messages = await this.prisma.messages.findMany({
      where: { channelId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
      include: {
        refs: true,
        mentions: true,
        files: true,
        reactions: true,
        replyTo: {
          select: { id: true, bodyMd: true, authorId: true, deletedAt: true },
        },
      },
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    const messagesWithAccess = await Promise.all(
      messages.map(async (message) => {
        if (message.refs && message.refs.length > 0) {
          const refsWithAccess = await Promise.all(
            message.refs.map(async (ref) => {
              try {
                const hasAccess = await this.objectsService.checkAccess(ref.objectId, userId);
                if (!hasAccess) {
                  return {
                    ...ref,
                    snapshotTitle: null,
                    snapshotTypeName: null,
                    canRead: false,
                  };
                }
                return { ...ref, canRead: true };
              } catch {
                return {
                  ...ref,
                  snapshotTitle: null,
                  snapshotTypeName: null,
                  canRead: false,
                };
              }
            }),
          );
          return { ...message, refs: refsWithAccess };
        }
        return message;
      }),
    );
    return messagesWithAccess.map((m) => this.maskDeleted(m));
  }

  private maskDeleted<
    T extends { deletedAt: Date | null; bodyMd: string; files: unknown[] },
  >(message: T): T {
    if (!message.deletedAt) return message;
    return { ...message, bodyMd: '', files: [] };
  }

  async findMessagePosition(
    channelId: string,
    userId: string,
    messageId: string,
  ) {
    await this.assertMember(channelId, userId);

    const target = await this.prisma.messages.findUnique({
      where: { id: messageId },
    });
    if (!target || target.channelId !== channelId) {
      throw new NotFoundException('message not found in this channel');
    }
    const newerCount = await this.prisma.messages.count({
      where: {
        channelId,
        deletedAt: null,
        createdAt: { gt: target.createdAt },
      },
    });
    return { newerCount };
  }
}
