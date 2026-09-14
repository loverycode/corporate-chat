import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
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

function looksLikeExecutableScript(buffer: Buffer): boolean {
  const head = buffer.subarray(0, 4096).toString('utf8');
  if (/^#!\s*\S+/.test(head)) return true;
  if (/^\s*@echo\s+off/im.test(head)) return true;
  if (/^\s*(#requires|param\s*\()/im.test(head)) return true;
  return false;
}

function hasExecutableMagicBytes(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  const magicBE = buffer.readUInt32BE(0);
  const EXECUTABLE_MAGICS_BE = [
    0xfeedface, 0xfeedfacf, 0xcefaedfe, 0xcffaedfe, 0xcafebabe, 0xbebafeca,
    0x7f454c46,
  ];
  if (EXECUTABLE_MAGICS_BE.includes(magicBE)) return true;
  if (buffer[0] === 0x4d && buffer[1] === 0x5a) return true;
  return false;
}
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
    if (hasExecutableMagicBytes(file.buffer)) {
      throw new BadRequestException('file type not allowed');
    }
    const detected = await fileTypeFromBuffer(file.buffer);
    if (detected) {
      if (DANGEROUS_MIME_TYPES.includes(detected.mime)) {
        throw new BadRequestException('file type not allowed');
      }
    } else if (looksLikeExecutableScript(file.buffer)) {
      throw new BadRequestException('file type not allowed');
    }

    const fileName =
      sanitizeFileName(
        Buffer.from(file.originalname, 'latin1').toString('utf8'),
      ) || 'file';
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
      throw new BadRequestException('attachment not found');
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

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupOrphanedAttachments() {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const orphaned = await this.prisma.attachments.findMany({
      where: { messageId: null, createdAt: { lt: cutoff } },
    });
    if (orphaned.length === 0) return;

    for (const attachment of orphaned) {
      await this.storage.deleteFile(attachment.storageKey).catch(() => {});
      if (attachment.thumbKey) {
        await this.storage.deleteFile(attachment.thumbKey).catch(() => {});
      }
    }

    await this.prisma.attachments.deleteMany({
      where: { id: { in: orphaned.map((a) => a.id) } },
    });
  }
}
