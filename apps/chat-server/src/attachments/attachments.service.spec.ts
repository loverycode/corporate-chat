import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AttachmentsService } from './attachments.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

jest.mock('file-type', () => ({
  fileTypeFromBuffer: jest.fn(),
}));

jest.mock('sharp', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    resize: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('fake-thumbnail')),
  })),
}));
jest.mock('@nestjs/schedule', () => ({
  Cron: () => () => {},
  CronExpression: {
    EVERY_HOUR: '0 0-23/1 * * *',
  },
}));
import { fileTypeFromBuffer } from 'file-type';
const fileTypeMock = fileTypeFromBuffer as jest.Mock;

describe('AttachmentsService', () => {
  let service: AttachmentsService;
  let prisma: {
    attachments: {
      create: jest.Mock;
      findUnique: jest.Mock;
    };
    channelMembers: {
      findUnique: jest.Mock;
    };
  };
  let storage: {
    uploadFile: jest.Mock;
    getDownloadUrl: jest.Mock;
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    prisma = {
      attachments: {
        create: jest.fn().mockResolvedValue({ id: 'att-1' }),
        findUnique: jest.fn().mockResolvedValue({
          id: 'att-1',
          storageKey: 'key',
        }),
      },
      channelMembers: {
        findUnique: jest.fn().mockResolvedValue({
          channelId: 'channel-1',
          userId: 'user-1',
        }),
      },
    };

    storage = {
      uploadFile: jest.fn().mockResolvedValue(undefined),
      getDownloadUrl: jest.fn().mockReturnValue('http://example.com/file'),
    };

    fileTypeMock.mockResolvedValue({
      mime: 'image/png',
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttachmentsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: StorageService,
          useValue: storage,
        },
      ],
    }).compile();

    service = module.get<AttachmentsService>(AttachmentsService);
  });

  describe('uploadFile', () => {
    const mockFile = (overrides: Partial<Express.Multer.File> = {}) =>
      ({
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
        size: 1024 * 1024,
        buffer: Buffer.from('test'),
        ...overrides,
      }) as Express.Multer.File;

    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('генерирует миниатюру для изображений', async () => {
      const file = mockFile();

      await service.uploadFile(file, 'user-1', 'channel-1');

      const sharpModule = jest.requireMock('sharp');
      const sharpMock = sharpModule.default as jest.Mock;

      expect(sharpMock).toHaveBeenCalledWith(file.buffer);

      const sharpInstance = sharpMock.mock.results[0].value;

      expect(sharpInstance.resize).toHaveBeenCalledWith(200, 200, {
        fit: 'inside',
      });

      expect(sharpInstance.toBuffer).toHaveBeenCalled();

      expect(storage.uploadFile).toHaveBeenCalledWith(
        expect.stringContaining('thumb.jpg'),
        expect.any(Buffer),
        'image/jpg',
      );

      expect(prisma.attachments.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          uploaderId: 'user-1',
          mime: 'image/jpeg',
          size: file.size,
          storageKey: expect.stringContaining('channels/channel-1/'),
          thumbKey: expect.stringContaining('channels/channel-1/'),
        }),
      });
    });

    it('не генерирует миниатюру для не-изображений', async () => {
      const file = mockFile({
        originalname: 'document.pdf',
        mimetype: 'application/pdf',
      });

      await service.uploadFile(file, 'user-1', 'channel-1');

      const sharpModule = jest.requireMock('sharp');
      const sharpMock = sharpModule.default as jest.Mock;

      expect(sharpMock).not.toHaveBeenCalled();

      expect(storage.uploadFile).toHaveBeenCalledTimes(1);

      expect(storage.uploadFile).toHaveBeenCalledWith(
        expect.stringContaining('document.pdf'),
        file.buffer,
        'application/pdf',
      );

      expect(prisma.attachments.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          uploaderId: 'user-1',
          mime: 'application/pdf',
          size: file.size,
          thumbKey: null,
        }),
      });
    });

    it('выбрасывает ошибку при файле больше 50 MB', async () => {
      const file = mockFile({
        size: 50 * 1024 * 1024 + 1,
      });

      await expect(
        service.uploadFile(file, 'user-1', 'channel-1'),
      ).rejects.toThrow(BadRequestException);

      expect(fileTypeMock).not.toHaveBeenCalled();
      expect(storage.uploadFile).not.toHaveBeenCalled();
      expect(prisma.attachments.create).not.toHaveBeenCalled();
    });

    it('разрешает файл размером ровно 50 MB', async () => {
      const file = mockFile({
        originalname: 'large.pdf',
        mimetype: 'application/pdf',
        size: 50 * 1024 * 1024,
      });

      await expect(
        service.uploadFile(file, 'user-1', 'channel-1'),
      ).resolves.toEqual({
        id: 'att-1',
      });

      expect(fileTypeMock).toHaveBeenCalledWith(file.buffer);

      expect(storage.uploadFile).toHaveBeenCalledWith(
        expect.stringContaining('large.pdf'),
        file.buffer,
        'application/pdf',
      );
    });

    it('выбрасывает ошибку при опасном расширении', async () => {
      const file = mockFile({
        originalname: 'virus.exe',
      });

      await expect(
        service.uploadFile(file, 'user-1', 'channel-1'),
      ).rejects.toThrow(BadRequestException);

      expect(fileTypeMock).not.toHaveBeenCalled();
      expect(storage.uploadFile).not.toHaveBeenCalled();
      expect(prisma.attachments.create).not.toHaveBeenCalled();
    });

    it('выбрасывает ошибку при опасном расширении без учёта регистра', async () => {
      const file = mockFile({
        originalname: 'VIRUS.EXE',
      });

      await expect(
        service.uploadFile(file, 'user-1', 'channel-1'),
      ).rejects.toThrow(BadRequestException);

      expect(fileTypeMock).not.toHaveBeenCalled();
    });

    it('выбрасывает ошибку при опасном MIME-типе', async () => {
      fileTypeMock.mockResolvedValueOnce({
        mime: 'application/x-msdownload',
      });

      const file = mockFile({
        originalname: 'payload.bin',
        mimetype: 'application/octet-stream',
      });

      await expect(
        service.uploadFile(file, 'user-1', 'channel-1'),
      ).rejects.toThrow(BadRequestException);

      expect(fileTypeMock).toHaveBeenCalledWith(file.buffer);

      expect(storage.uploadFile).not.toHaveBeenCalled();
      expect(prisma.attachments.create).not.toHaveBeenCalled();
    });

    it('отклоняет Mach-O бинарник, переименованный под безобидное расширение', async () => {
      fileTypeMock.mockResolvedValueOnce(undefined);

      const machOHeader = Buffer.from([
        0xfe, 0xed, 0xfa, 0xcf, 0x00, 0x00, 0x00, 0x00,
      ]);
      const file = mockFile({
        originalname: 'innocent.txt',
        mimetype: 'text/plain',
        buffer: machOHeader,
      });

      await expect(
        service.uploadFile(file, 'user-1', 'channel-1'),
      ).rejects.toThrow(BadRequestException);

      expect(storage.uploadFile).not.toHaveBeenCalled();
      expect(prisma.attachments.create).not.toHaveBeenCalled();
    });

    it('отклоняет ELF-бинарник, переименованный под безобидное расширение', async () => {
      fileTypeMock.mockResolvedValueOnce(undefined);

      const elfHeader = Buffer.from([
        0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00,
      ]);
      const file = mockFile({
        originalname: 'innocent.png',
        mimetype: 'image/png',
        buffer: elfHeader,
      });

      await expect(
        service.uploadFile(file, 'user-1', 'channel-1'),
      ).rejects.toThrow(BadRequestException);

      expect(storage.uploadFile).not.toHaveBeenCalled();
    });

    it('отклоняет shell-скрипт, переименованный под безобидное расширение', async () => {
      fileTypeMock.mockResolvedValueOnce(undefined);

      const file = mockFile({
        originalname: 'evil.txt',
        mimetype: 'text/plain',
        buffer: Buffer.from('#!/bin/bash\nrm -rf /\n'),
      });

      await expect(
        service.uploadFile(file, 'user-1', 'channel-1'),
      ).rejects.toThrow(BadRequestException);

      expect(storage.uploadFile).not.toHaveBeenCalled();
      expect(prisma.attachments.create).not.toHaveBeenCalled();
    });

    it('отклоняет batch-файл, переименованный под безобидное расширение', async () => {
      fileTypeMock.mockResolvedValueOnce(undefined);

      const file = mockFile({
        originalname: 'evil.png',
        mimetype: 'image/png',
        buffer: Buffer.from('@echo off\ndel /f /q C:\\*.*\n'),
      });

      await expect(
        service.uploadFile(file, 'user-1', 'channel-1'),
      ).rejects.toThrow(BadRequestException);

      expect(storage.uploadFile).not.toHaveBeenCalled();
    });

    it('использует file.mimetype, если file-type ничего не определил', async () => {
      fileTypeMock.mockResolvedValueOnce(undefined);

      const file = mockFile({
        originalname: 'document.pdf',
        mimetype: 'application/pdf',
      });

      await expect(
        service.uploadFile(file, 'user-1', 'channel-1'),
      ).resolves.toEqual({
        id: 'att-1',
      });

      expect(fileTypeMock).toHaveBeenCalledWith(file.buffer);

      expect(storage.uploadFile).toHaveBeenCalledWith(
        expect.stringContaining('document.pdf'),
        file.buffer,
        'application/pdf',
      );
    });

    it('сохраняет attachment в Prisma', async () => {
      const file = mockFile();

      await service.uploadFile(file, 'user-1', 'channel-1');

      expect(prisma.attachments.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          uploaderId: 'user-1',
          mime: 'image/jpeg',
          size: file.size,
          storageKey: expect.stringContaining('channels/channel-1/'),
          thumbKey: expect.stringContaining('-thumb.jpg'),
          fileName: expect.any(String),
        }),
      });
    });
  });

  describe('getDownloadFile', () => {
    it('возвращает URL для скачивания для вложения, привязанного к сообщению', async () => {
      const mockAttachment = {
        id: 'att-1',
        storageKey: 'key',
        uploaderId: 'user-1',
        message: { channelId: 'channel-1' },
      };
      const mockMembership = { channelId: 'channel-1', userId: 'user-1' };

      prisma.attachments.findUnique.mockResolvedValueOnce(mockAttachment);
      prisma.channelMembers.findUnique.mockResolvedValueOnce(mockMembership);
      storage.getDownloadUrl.mockResolvedValueOnce('http://example.com/file');

      const url = await service.getDownloadFile('att-1', 'user-1');
      expect(url).toBe('http://example.com/file');
      expect(prisma.attachments.findUnique).toHaveBeenCalledWith({
        where: { id: 'att-1' },
        include: { message: { select: { channelId: true } } },
      });

      expect(prisma.channelMembers.findUnique).toHaveBeenCalledWith({
        where: {
          channelId_userId: {
            channelId: 'channel-1',
            userId: 'user-1',
          },
        },
      });

      expect(storage.getDownloadUrl).toHaveBeenCalledWith('key');
    });

    it('возвращает URL для скачивания для непривязанного вложения (загрузивший пользователь)', async () => {
      const mockAttachment = {
        id: 'att-1',
        storageKey: 'key',
        uploaderId: 'user-1',
        message: null,
      };

      prisma.attachments.findUnique.mockResolvedValueOnce(mockAttachment);
      storage.getDownloadUrl.mockResolvedValueOnce('http://example.com/file');

      const url = await service.getDownloadFile('att-1', 'user-1');

      expect(url).toBe('http://example.com/file');
      expect(prisma.channelMembers.findUnique).not.toHaveBeenCalled();
      expect(storage.getDownloadUrl).toHaveBeenCalledWith('key');
    });

    it('выбрасывает ошибку Forbidden для непривязанного вложения не от загрузившего', async () => {
      const mockAttachment = {
        id: 'att-1',
        storageKey: 'key',
        uploaderId: 'user-1',
        message: null,
      };
      prisma.attachments.findUnique.mockResolvedValueOnce(mockAttachment);

      await expect(service.getDownloadFile('att-1', 'user-2')).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.getDownloadFile('att-1', 'user-2')).rejects.toThrow(
        'Attachment not yet attached to a message',
      );

      expect(storage.getDownloadUrl).not.toHaveBeenCalled();
    });

    it('выбрасывает ошибку Forbidden, если пользователь не участник канала', async () => {
      const mockAttachment = {
        id: 'att-1',
        storageKey: 'key',
        uploaderId: 'user-1',
        message: { channelId: 'channel-1' },
      };

      prisma.attachments.findUnique.mockResolvedValue(mockAttachment);
      prisma.channelMembers.findUnique.mockResolvedValue(null);

      await expect(service.getDownloadFile('att-1', 'user-2')).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.getDownloadFile('att-1', 'user-2')).rejects.toThrow(
        'You are not a member of this channel',
      );

      expect(storage.getDownloadUrl).not.toHaveBeenCalled();
    });

    it('выбрасывает ошибку NotFoundException, если вложение не найдено', async () => {
      prisma.attachments.findUnique.mockResolvedValue(null);

      await expect(
        service.getDownloadFile('missing', 'user-1'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.getDownloadFile('missing', 'user-1'),
      ).rejects.toThrow('attachment not found');

      expect(storage.getDownloadUrl).not.toHaveBeenCalled();
    });
  });

  describe('getThumbnailUrl', () => {
    it('возвращает URL миниатюры для изображения', async () => {
      const mockAttachment = {
        id: 'att-1',
        thumbKey: 'thumb-key',
        uploaderId: 'user-1',
        message: { channelId: 'channel-1' },
      };
      const mockMembership = { channelId: 'channel-1', userId: 'user-1' };

      prisma.attachments.findUnique.mockResolvedValueOnce(mockAttachment);
      prisma.channelMembers.findUnique.mockResolvedValueOnce(mockMembership);
      storage.getDownloadUrl.mockResolvedValueOnce('http://example.com/thumb');

      const url = await service.getThumbnailUrl('att-1', 'user-1');

      expect(url).toBe('http://example.com/thumb');
      expect(storage.getDownloadUrl).toHaveBeenCalledWith('thumb-key');
    });

    it('выбрасывает ошибку если миниатюра недоступна', async () => {
      const mockAttachment = {
        id: 'att-1',
        thumbKey: null,
        uploaderId: 'user-1',
        message: { channelId: 'channel-1' },
      };

      prisma.attachments.findUnique.mockResolvedValueOnce(mockAttachment);
      await expect(service.getThumbnailUrl('att-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.getThumbnailUrl('att-1', 'user-1')).rejects.toThrow(
        'Thumbnail not available',
      );
    });

    it('выбрасывает ошибку NotFoundException если вложение не найдено', async () => {
      prisma.attachments.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.getThumbnailUrl('missing', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('выбрасывает ошибку Forbidden для непривязанного вложения не от загрузившего', async () => {
      const mockAttachment = {
        id: 'att-1',
        thumbKey: 'thumb-key',
        uploaderId: 'user-1',
        message: null,
      };

      prisma.attachments.findUnique.mockResolvedValueOnce(mockAttachment);
      await expect(service.getThumbnailUrl('att-1', 'user-2')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
