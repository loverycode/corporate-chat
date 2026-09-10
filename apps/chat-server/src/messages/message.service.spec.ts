import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { MessagesService } from './message.service';
import { PrismaService } from '../prisma/prisma.service';
import { MessagesGateway } from './messages.gateway';
import { ObjectsService } from '../objects/objects.service';
import { EVENTS_PUBLISHER } from '../events/events-publisher.interface';

describe('MessagesService', () => {
  let service: MessagesService;
  let prisma: any;
  let gateway: any;
  let objectsService: any;
  let eventsPublisher: any;

  beforeEach(async () => {
    prisma = {
      channelMembers: { findUnique: jest.fn(), findMany: jest.fn() },
      messages: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      objectRefs: { create: jest.fn() },
      mentions: { create: jest.fn() },
      attachments: { updateMany: jest.fn() },
    };
    gateway = {
      emitMessageCreated: jest.fn(),
      emitMessageUpdated: jest.fn(),
      emitMessageDeleted: jest.fn(),
    };
    objectsService = {
      extractObjectIds: jest.fn().mockReturnValue([]),
      resolveObjects: jest.fn(),
    };
    eventsPublisher = {
      publishToUser: jest.fn(),
      publishToChannel: jest.fn(),
      publishToAll: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesService,
        { provide: PrismaService, useValue: prisma },
        { provide: MessagesGateway, useValue: gateway },
        { provide: ObjectsService, useValue: objectsService },
        { provide: EVENTS_PUBLISHER, useValue: eventsPublisher },
      ],
    }).compile();

    service = module.get<MessagesService>(MessagesService);
  });

  describe('create', () => {
    it('бросает ForbiddenException, если пользователь не участник канала', async () => {
      prisma.channelMembers.findUnique.mockResolvedValue(null);

      await expect(
        service.create(
          'channel-1',
          { bodyMd: 'привет', clientMessageId: 'client-1' } as any,
          'user-1',
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.messages.create).not.toHaveBeenCalled();
    });

    it('возвращает существующее сообщение при повторе с тем же clientMessageId (защита от дублей)', async () => {
      prisma.channelMembers.findUnique.mockResolvedValue({
        channelId: 'channel-1',
        userId: 'user-1',
      });
      const existing = { id: 'msg-1', bodyMd: 'привет' };
      prisma.messages.findUnique.mockResolvedValue(existing);

      const result = await service.create(
        'channel-1',
        { bodyMd: 'привет', clientMessageId: 'client-1' },
        'user-1',
      );

      expect(result).toBe(existing);
      expect(prisma.messages.create).not.toHaveBeenCalled();
    });

    it('создаёт сообщение и рассылает событие через gateway', async () => {
      prisma.channelMembers.findUnique.mockResolvedValue({
        channelId: 'channel-1',
        userId: 'user-1',
      });
      prisma.messages.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'new-msg',
          channelId: 'channel-1',
          refs: [],
          mentions: [],
          files: [],
        });
      prisma.messages.create.mockResolvedValue({
        id: 'new-msg',
        channelId: 'channel-1',
      });

      const result = await service.create(
        'channel-1',
        { bodyMd: 'привет', clientMessageId: 'client-1' },
        'user-1',
      );

      expect(result).toEqual(expect.objectContaining({ id: 'new-msg' }));
      expect(gateway.emitMessageCreated).toHaveBeenCalledWith(
        'channel-1',
        expect.objectContaining({ id: 'new-msg' }),
      );
    });

    it('бросает NotFoundException при replyToId из другого канала', async () => {
      prisma.channelMembers.findUnique.mockResolvedValue({
        channelId: 'channel-1',
        userId: 'user-1',
      });
      prisma.messages.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'reply-target',
          channelId: 'other-channel',
        });

      await expect(
        service.create(
          'channel-1',
          {
            bodyMd: 'ответ',
            clientMessageId: 'client-2',
            replyToId: 'reply-target',
          } as any,
          'user-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('бросает ForbiddenException при попытке править чужое сообщение', async () => {
      prisma.messages.findUnique.mockResolvedValue({
        id: 'msg-1',
        authorId: 'other-user',
        deletedAt: null,
      });

      await expect(
        service.update('msg-1', { bodyMd: 'новый текст' }, 'user-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('бросает NotFoundException при попытке править удалённое сообщение', async () => {
      prisma.messages.findUnique.mockResolvedValue({
        id: 'msg-1',
        authorId: 'user-1',
        deletedAt: new Date(),
      });

      await expect(
        service.update('msg-1', { bodyMd: 'новый текст' }, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('бросает ForbiddenException при попытке удалить чужое сообщение', async () => {
      prisma.messages.findUnique.mockResolvedValue({
        id: 'msg-1',
        authorId: 'other-user',
        deletedAt: null,
      });

      await expect(service.remove('msg-1', 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('findHistory', () => {
    it('бросает ForbiddenException, если пользователь не участник', async () => {
      prisma.channelMembers.findUnique.mockResolvedValue(null);

      await expect(service.findHistory('channel-1', 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('использует cursor при подгрузке следующей порции', async () => {
      prisma.channelMembers.findUnique.mockResolvedValue({
        channelId: 'channel-1',
        userId: 'user-1',
      });
      prisma.messages.findMany.mockResolvedValue([]);

      await service.findHistory('channel-1', 'user-1', 'some-msg-id', 20);

      expect(prisma.messages.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 20,
          skip: 1,
          cursor: { id: 'some-msg-id' },
        }),
      );
    });
  });
});