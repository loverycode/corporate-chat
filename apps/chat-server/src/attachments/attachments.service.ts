import { Injectable, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { fileTypeFromBuffer } from 'file-type';
const MAX_SIZE_BYTES = 20 * 1024 * 1024;
const DANGEROUS_MIME_TYPES = [
  'application/x-msdownload',
  'application/x-executable',
  'application/x-sh',
  'application/x-bat',
  'application/x-msdos-program',
  'application/vnd.microsoft.portable-executable',
  'application/java-archive',
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
];

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async uploadFile(
    file: Express.Multer.File,
    uploaderId: string,
    channelId: string,
  ) {
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

    const fileName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const fileId = randomUUID();
    const storageKey = `channels/${channelId}/${fileId}-${file.originalname}`;

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
        fileName,
        mime: file.mimetype,
        size: file.size,
        storageKey,
        thumbKey,
      },
    });
  }

  async getDownloadFile(attachmentsId: string) {
    const attachment = await this.prisma.attachments.findUnique({
      where: { id: attachmentsId },
    });
    if (!attachment) {
      throw new BadRequestException('attachment not found');
    }
    return this.storage.getDownloadUrl(attachment.storageKey);
  }
}
