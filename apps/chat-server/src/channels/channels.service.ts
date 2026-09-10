import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException, Inject
} from '@nestjs/common';
import { CreateChannelDto } from './create-channel.dto';
import { UpdateChannelDto } from './update-channel.dto';
import { PrismaService } from '../prisma/prisma.service';
import { ChannelRole, ChannelType } from '@prisma/client';
import { Prisma } from '@prisma/client';
import type {EventsPublisher } from '../events/events-publisher.interface';
import {EVENTS_PUBLISHER} from '../events/events-publisher.interface';
@Injectable()
export class ChannelsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(EVENTS_PUBLISHER) private readonly eventsPublisher: EventsPublisher,
  ) {}
  private validateCreateChannel(dto: CreateChannelDto) {
    if (dto.type === ChannelType.direct) {
      if (!dto.members || dto.members.length !== 2) {
        throw new BadRequestException(
          'direct channel requires exactly 2 members',
        );
      }
    } else if (dto.type === ChannelType.group) {
      if (!dto.members || dto.members.length === 0 || !dto.title) {
        throw new BadRequestException(
          'group channel requires members and title',
        );
      }
    } else if (dto.type === ChannelType.context) {
      if (!dto.contextObjectId) {
        throw new BadRequestException('contextObjectId is requied!');
      }
      if (!dto.members || dto.members.length === 0) {
        throw new BadRequestException('context channel requires members');
      }
    }
  }
  async create(dto: CreateChannelDto, currentUserId: string) {
    this.validateCreateChannel(dto);
    let channel;
    switch (dto.type) {
      case ChannelType.direct:
        if (!dto.members.includes(currentUserId)) {
          throw new ForbiddenException(
            'cannot create a direct channel you are not part of',
          );
        }
        channel = await this.createDirect(dto.members, currentUserId);
        break;
      case ChannelType.group:
        channel = await this.createGroup(dto, currentUserId);
        break;
      case ChannelType.context:
        channel = await this.createContext(dto, currentUserId);
        break;
    }
    if (channel && channel.members) {
      for (const member of channel.members) {
        this.eventsPublisher.publishToUser(member.userId, 'channel.created', channel);
      }
    }
    return channel;
  }
  async createDirect(members: string[], currentUserId: string) {
    const [userA, userB] = members;
    const existing = await this.prisma.channels.findFirst({
      where: {
        type: ChannelType.direct,
        AND: [
          { members: { some: { userId: userA } } },
          { members: { some: { userId: userB } } },
        ],
      },
      include: { members: true },
    });
    if (existing) {
      return existing;
    }

    const channel = await this.prisma.channels.create({
      data: {
        type: ChannelType.direct,
        createdBy: currentUserId,
        members: {
          create: [
            { userId: userA, role: ChannelRole.member },
            { userId: userB, role: ChannelRole.member },
          ],
        },
      },
      include: { members: true },
    });

    for (const member of channel.members) {
      this.eventsPublisher.joinRoom(member.userId, channel.id);
    }
    return channel;
  }
  async createGroup(dto: CreateChannelDto, currentUserId: string) {
    const memberIds = Array.from(new Set([currentUserId, ...dto.members]));
    const channel = await this.prisma.channels.create({
      data: {
        type: ChannelType.group,
        title: dto.title!,
        description: dto.description,
        createdBy: currentUserId,
        members: {
          create: memberIds.map((userId) => ({
            userId,
            role:
              userId === currentUserId ? ChannelRole.owner : ChannelRole.member,
          })),
        },
      },
      include: { members: true },
    });
    if (channel && channel.members) {
      for (const member of channel.members) {
        this.eventsPublisher.publishToUser(member.userId, 'channel.created', channel);
        this.eventsPublisher.joinRoom(member.userId, channel.id);
      }
    }

    return channel;
  }

  async createContext(dto: CreateChannelDto, currentUserId: string) {
    try {
      const existing = await this.prisma.channels.findFirst({
        where: {
          type: ChannelType.context,
          contextObjectId: dto.contextObjectId,
        },
        include: { members: true },
      });

      if (existing) {
        const isMember = existing.members.some(m => m.userId === currentUserId);
        if (!isMember) {
          await this.prisma.channelMembers.create({
            data: {
              channelId: existing.id,
              userId: currentUserId,
              role: ChannelRole.member,
            },
          });
          this.eventsPublisher.joinRoom(currentUserId, existing.id);
        }
        const updatedChannel = await this.prisma.channels.findUnique({
          where: { id: existing.id },
          include: { members: { include: { user: true } } },
        });
        if (updatedChannel) {
          for (const member of updatedChannel.members) {
            this.eventsPublisher.publishToUser(member.userId, 'members.updated', {
              channelId: updatedChannel.id,
              members: updatedChannel.members,
            });
            this.eventsPublisher.publishToUser(member.userId, 'channel.updated', updatedChannel);
          }
        }
        return updatedChannel || existing;
      }

      const memberIds = Array.from(new Set([currentUserId, ...dto.members]));
      const newChannel = await this.prisma.channels.create({
        data: {
          type: ChannelType.context,
          title: dto.title!,
          contextObjectId: dto.contextObjectId,
          createdBy: currentUserId,
          members: {
            create: memberIds.map((userId) => ({
              userId,
              role: userId === currentUserId ? ChannelRole.owner : ChannelRole.member,
            })),
          },
        },
        include: { members: true },
      });

      if (newChannel && newChannel.members) {
        for (const member of newChannel.members) {
          this.eventsPublisher.publishToUser(member.userId, 'channel.created', newChannel);
          this.eventsPublisher.joinRoom(member.userId, newChannel.id);
        }
      }

      return newChannel;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await this.prisma.channels.findFirst({
          where: {
            type: ChannelType.context,
            contextObjectId: dto.contextObjectId,
          },
          include: { members: { include: { user: true } } },
        });
        if (existing) {
          const isMember = existing.members.some(m => m.userId === currentUserId);
          if (!isMember) {
            await this.prisma.channelMembers.create({
              data: {
                channelId: existing.id,
                userId: currentUserId,
                role: ChannelRole.member,
              },
            });
            this.eventsPublisher.joinRoom(currentUserId, existing.id);
            const updatedChannel = await this.prisma.channels.findUnique({
              where: { id: existing.id },
              include: { members: { include: { user: true } } },
            });
            if (updatedChannel) {
              for (const member of updatedChannel.members) {
                this.eventsPublisher.publishToUser(member.userId, 'members.updated', {
                  channelId: updatedChannel.id,
                  members: updatedChannel.members,
                });
                this.eventsPublisher.publishToUser(member.userId, 'channel.updated', updatedChannel);
              }
              return updatedChannel;
            }
          }
          return existing;
        }
      }
      throw error;
    }
  }

  async findById(id: string, currentUserId: string) {
    const channel = await this.prisma.channels.findUnique({
      where: { id },
      include: { members: { include: { user: true } } },
    });
    if (!channel) throw new NotFoundException('Channel not found');
    const isMember = channel.members.some((m) => m.userId === currentUserId);
    if (!isMember) throw new ForbiddenException('not a member of this channel');

    return channel;
  }

  async findUserChannels(currentUserId: string) {
    const channels = await this.prisma.channels.findMany({
      where: {
        members: { some: { userId: currentUserId } },
      },
      include: {
        messages: { orderBy: { createdAt: 'desc' }, take: 1, include: { files: true } },
        members: { include: { user: true } },
      },
    });

    const result = await Promise.all(
      channels.map(async (channel) => {
        const membership = channel.members.find(
          (m) => m.userId === currentUserId,
        );
        const unreadCount = await this.prisma.messages.count({
          where: {
            channelId: channel.id,
            deletedAt: null,
            ...(membership?.lastReadMessageId
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
        return {
          ...channel,
          title: channel.type === ChannelType.direct ? channel.members.find((m) => m.userId !== currentUserId)?.user?.name ?? '' : channel.title,
          lastMessage: channel.messages[0] ?? null,
          unreadCount,
        };
      }),
    );

    return result.sort((a, b) => {
      const aTime = (a.lastMessage?.createdAt ?? a.createdAt).getTime();
      const bTime = (b.lastMessage?.createdAt ?? b.createdAt).getTime();
      return bTime - aTime;
    });
  }

  async markRead(channelId: string, userId: string, messageId: string) {
    const membership = await this.prisma.channelMembers.findUnique({
    where: { channelId_userId: { channelId, userId } },
    });
    if (!membership) {
      throw new ForbiddenException('You are not a member of this channel');
    }
    const message = await this.prisma.messages.findUnique({
      where: { id: messageId },
    });
    if (!message || message.channelId !== channelId) {
      throw new NotFoundException('message not found in this channel');
    }
    await this.prisma.channelMembers.update({
      where: { channelId_userId: { channelId, userId } },
      data: { lastReadMessageId: messageId },
    });
    const summary = await this.getUnreadSummary(userId);
    this.eventsPublisher.publishToUser(
      userId,
     'unread.changed', 
    {
      channelId,
      total: summary.total,
      count: summary.perChannel[channelId] ?? 0,
    });
    return { ok: true };
  }

  async getUnreadSummary(userId: string) {
    const memberships = await this.prisma.channelMembers.findMany({
      where: { userId },
      select: { channelId: true, lastReadMessageId: true },
    });

    const perChannel: Record<string, number> = {};
    let total = 0;
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
      perChannel[membership.channelId] = count;
      total += count;
    }
    return { total, perChannel };
  }
  async update(channelId: string, dto: UpdateChannelDto, userId: string) {
      const membership = await this.prisma.channelMembers.findUnique({
          where: { channelId_userId: { channelId, userId } },
      });
      if (!membership) {
          throw new ForbiddenException('not a member of this channel');
      }
      if (membership.role !== ChannelRole.owner) {
          throw new ForbiddenException('only the owner can edit the channel');
      }

      const updated = await this.prisma.channels.update({
          where: { id: channelId },
          data: {
              ...(dto.title !== undefined ? { title: dto.title } : {}),
              ...(dto.description !== undefined ? { description: dto.description } : {}),
          },
          include: { members: {select: {userId: true, role: true, lastReadMessageId: true, user: true}} },
      });
      if (updated && updated.members) {
      for (const member of updated.members) {
        this.eventsPublisher.publishToUser(member.userId, 'channel.updated', updated);
      }
    }
    return updated;
      
  }

  async addMembers(channelId: string, newUserIds: string[], userId: string) {
      const membership = await this.prisma.channelMembers.findUnique({
          where: { channelId_userId: { channelId, userId } },
      });
      if (!membership) {
          throw new ForbiddenException('not a member of this channel');
      }
      if (membership.role !== ChannelRole.owner) {
          throw new ForbiddenException('only the owner can add members');
      }

      const existing = await this.prisma.channelMembers.findMany({
          where: { channelId, userId: { in: newUserIds } },
          select: { userId: true },
      });
      const existingIds = new Set(existing.map((m) => m.userId));
      const toAdd = newUserIds.filter((id) => !existingIds.has(id));

      if (toAdd.length > 0) {
          await this.prisma.channelMembers.createMany({
              data: toAdd.map((newUserId) => ({
                  channelId,
                  userId: newUserId,
                  role: ChannelRole.member,
              })),
          });
      }

      const updatedChannel = await this.prisma.channels.findUnique({
          where: { id: channelId },
          include: { members: { include: { user: true } } },
      });
      if (updatedChannel && toAdd.length > 0) {
      for (const newUserId of toAdd) {
        this.eventsPublisher.joinRoom(newUserId, channelId);
      }
      for (const member of updatedChannel.members) {
        this.eventsPublisher.publishToUser(member.userId, 'members.updated',{channelId, members: updatedChannel.members});
      }
      for (const member of updatedChannel.members) {
            this.eventsPublisher.publishToUser(member.userId, 'channel.updated', updatedChannel);
      }
    }
    return updatedChannel;
  }
  async deleteChannel(channelId: string, userId: string) {
    const membership = await this.prisma.channelMembers.findUnique({
        where: { channelId_userId: { channelId, userId } },
    });
    if (!membership) {
        throw new ForbiddenException('not a member of this channel');
    }
    if (membership.role !== ChannelRole.owner) {
        throw new ForbiddenException('only the owner can delete the channel');
    }
    const channel = await this.prisma.channels.findUnique({
        where: { id: channelId },
        include: { members: true },
    });
    await this.prisma.channels.update({
        where: { id: channelId },
        data: { archivedAt: new Date() },
    });

    if (channel) {
        for (const member of channel.members) {
            this.eventsPublisher.publishToUser(member.userId, 'channel.deleted', {channelId});
        }
    }
    return { ok: true };
}
  async removeMember(channelId: string, targetUserId: string, requesterId: string) {
      const requesterMembership = await this.prisma.channelMembers.findUnique({
          where: { channelId_userId: { channelId, userId: requesterId } },
      });
      if (!requesterMembership) {
          throw new ForbiddenException('not a member of this channel');
      }

      const isSelfLeaving = requesterId === targetUserId;
      if (isSelfLeaving && requesterMembership.role === ChannelRole.owner) {
           const otherMembers = await this.prisma.channelMembers.findMany({
            where: {channelId, userId: { not: targetUserId }},
          });
          if (otherMembers.length > 0) {
            const newOwner = otherMembers[0];
            await this.prisma.channelMembers.update({
              where: { 
                channelId_userId: { channelId, userId: newOwner.userId } 
              },
              data: { role: ChannelRole.owner },
          });
          } 
          else {
            await this.prisma.channels.update({
              where: { id: channelId },
              data: { archivedAt: new Date() },
            });
            this.eventsPublisher.publishToUser(targetUserId, 'channel.deleted', { channelId });
            return { ok: true };
          }
        }
        if (!isSelfLeaving && requesterMembership.role !== ChannelRole.owner) {
          throw new ForbiddenException('only the owner can remove other members');
        }
      await this.prisma.channelMembers.delete({
          where: { channelId_userId: { channelId, userId: targetUserId } },
      });
      const updatedChannel = await this.prisma.channels.findUnique({where: { id: channelId }, include: { members: { include: { user: true } } }});
      if (updatedChannel){
        const payload = {channelId, userId: targetUserId, members: updatedChannel.members};
        for (const member of updatedChannel.members) {
            this.eventsPublisher.publishToUser(member.userId, 'member.removed',payload);
            this.eventsPublisher.publishToUser(member.userId, 'channel.updated', updatedChannel);
    }
      this.eventsPublisher.publishToUser(targetUserId, 'member.removed', payload);
      return { ok: true };
    }
  }

  private async getMessageCreatedAt(messageId: string): Promise<Date> {
    const message = await this.prisma.messages.findUnique({
      where: { id: messageId },
      select: { createdAt: true },
    });
    return message?.createdAt ?? new Date(0);
  }
}
