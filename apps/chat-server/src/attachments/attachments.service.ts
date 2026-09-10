import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { fileTypeFromBuffer } from 'file-type';
const MAX_SIZE_BYTES =
  parseInt(process.env.MAX_FILE_SIZE_MB || '50') * 1024 * 1024;
const DANGEROUS_MIME_TYPES = [
  'application/x-msdownload',
  'application/x-executable',
  'application/x-sh',
  'application/x-bat',
  'application/x-msdos-program',
  'application/vnd.microsoft.portable-executable',
  'application/java-archive',
  'text/html',
  'image/svg+xml',
  'text/javascript',
  'application/javascript',
];
const DANGEROUS_EXTENSIONS = [
  '.exe',
  '.bat',
  '.cmd',
  '.sh',
  '.com',
  '.msi',
  '.scr',
  '.jar',
  '.app',
  '.js',
  '.vbs',
  '.ps1',
  '.html',
  '.htm',
  '.svg',
];
function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9а-яА-Я\s\-_.()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}
  private async assertChannelMember(userId: string, channelId: string) {
    const membership = await this.prisma.channelMembers.findUnique({
      where: {
        channelId_userId: { channelId, userId },
      },
    });
    if (!membership) {
      throw new ForbiddenException('You are not a member of this channel');
    }
  }

  async uploadFile(
    file: Express.Multer.File,
    uploaderId: string,
    channelId: string,
  ) {
    await this.assertChannelMember(uploaderId, channelId);

    if (file.size > MAX_SIZE_BYTES) {
      throw new BadRequestException('file too large');
    }

    const lowerName = file.originalname.toLowerCase();
    if (DANGEROUS_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) {
      throw new BadRequestException('file type not allowed');
    }
    const detected = await fileTypeFromBuffer(file.buffer);
    const realMime = detected?.mime || file.mimetype;
    if (DANGEROUS_MIME_TYPES.includes(realMime)) {
      throw new BadRequestException('file type not allowed');
    }

    const decodedName = Buffer.from(file.originalname, 'latin1').toString(
      'utf8',
    );
    const fileName = sanitizeFileName(decodedName) || `file-${randomUUID()}`;
    const fileId = randomUUID();
    const storageKey = `channels/${channelId}/${fileId}-${fileName}`;

    await this.storage.uploadFile(storageKey, file.buffer, file.mimetype);

    let thumbKey: string | null = null;
    if (file.mimetype.startsWith('image/')) {
      const thumbBuffer = await sharp(file.buffer)
        .resize(200, 200, { fit: 'inside' })
        .toBuffer();
      thumbKey = `channels/${channelId}/${fileId}-thumb.jpg`;
      await this.storage.uploadFile(thumbKey, thumbBuffer, 'image/jpg');
    }
    return this.prisma.attachments.create({
      data: {
        uploaderId,
        channelId,
        fileName,
        mime: file.mimetype,
        size: file.size,
        storageKey,
        thumbKey,
      },
    });
  }

  async getDownloadFile(attachmentsId: string, userId: string) {
    const attachment = await this.prisma.attachments.findUnique({
      where: { id: attachmentsId },
      include: { message: { select: { channelId: true } } },
    });
    if (!attachment) {
      throw new NotFoundException('attachment not found');
    }
    if (attachment.message && attachment.message.channelId) {
      await this.assertChannelMember(userId, attachment.message.channelId);
    } else {
      if (attachment.uploaderId !== userId) {
        throw new ForbiddenException(
          'Attachment not yet attached to a message',
        );
      }
    }
    return this.storage.getDownloadUrl(attachment.storageKey);
  }

  async getThumbnailUrl(attachmentsId: string, userId: string) {
    const attachment = await this.prisma.attachments.findUnique({
      where: { id: attachmentsId },
      include: { message: { select: { channelId: true } } },
    });
    if (!attachment) {
      throw new NotFoundException('attachment not found');
    }
    if (!attachment.thumbKey) {
      throw new BadRequestException('Thumbnail not available');
    }
    if (attachment.message && attachment.message.channelId) {
      await this.assertChannelMember(userId, attachment.message.channelId);
    } else {
      if (attachment.uploaderId !== userId) {
        throw new ForbiddenException(
          'Attachment not yet attached to a message',
        );
      }
    }
    return this.storage.getDownloadUrl(attachment.thumbKey);
  }
}
