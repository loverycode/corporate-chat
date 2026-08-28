import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AttachmentsService } from './attachments.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { fileTypeFromBuffer } from 'file-type';

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

describe('AttachmentsService', () => {
  let service: AttachmentsService;
  let prisma: {
    attachments: {
      create: jest.Mock;
      findUnique: jest.Mock;
    };
  };
  let storage: {
    uploadFile: jest.Mock;
    getDownloadUrl: jest.Mock;
  };
  let fileTypeMock: jest.Mock;

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
    };

    storage = {
      uploadFile: jest.fn().mockResolvedValue(undefined),
      getDownloadUrl: jest.fn().mockReturnValue('http://example.com/file'),
    };

    fileTypeMock = fileTypeFromBuffer as jest.Mock;

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

    it('выбрасывает ошибку при файле больше 20 MB', async () => {
      const file = mockFile({
        size: 20 * 1024 * 1024 + 1,
      });

      await expect(
        service.uploadFile(file, 'user-1', 'channel-1'),
      ).rejects.toThrow(BadRequestException);

      expect(fileTypeMock).not.toHaveBeenCalled();
      expect(storage.uploadFile).not.toHaveBeenCalled();
      expect(prisma.attachments.create).not.toHaveBeenCalled();
    });

    it('разрешает файл размером ровно 20 MB', async () => {
      const file = mockFile({
        originalname: 'large.pdf',
        mimetype: 'application/pdf',
        size: 20 * 1024 * 1024,
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
    it('возвращает URL для скачивания', async () => {
      const url = await service.getDownloadFile('att-1');

      expect(url).toBe('http://example.com/file');

      expect(prisma.attachments.findUnique).toHaveBeenCalledWith({
        where: {
          id: 'att-1',
        },
      });

      expect(storage.getDownloadUrl).toHaveBeenCalledWith('key');
    });

    it('выбрасывает ошибку, если вложение не найдено', async () => {
      prisma.attachments.findUnique.mockResolvedValueOnce(null);

      await expect(service.getDownloadFile('missing')).rejects.toThrow(
        BadRequestException,
      );

      expect(storage.getDownloadUrl).not.toHaveBeenCalled();
    });
  });
});
