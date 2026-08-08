import { Injectable, BadRequestException } from "@nestjs/common";
import { randomUUID} from "crypto";
import sharp from 'sharp';
import { PrismaService } from "src/prisma/prisma.service";
import { StorageService } from "src/storage/storage.service";

const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 МБ
const ALLOWED_MIME_PREFIXES = ['image/', 'application/pdf', 'text/'];

@Injectable()
export class AttachmentsService{
    constructor(
        private readonly prisma: PrismaService,
        private readonly storage: StorageService,
    ){}
    async uploadFile(file: Express.Multer.File, uploaderId: string, channelId: string){
        if (file.size> MAX_SIZE_BYTES){
            throw new BadRequestException('file too large');
        }
        const isAllowed = ALLOWED_MIME_PREFIXES.some((prefix)=>file.mimetype.startsWith(prefix));
        if (!isAllowed){
            throw new BadRequestException('file type not allowed');
        }
        const fileId = randomUUID();
        const storageKey = `channels/${channelId}/${fileId}-${file.originalname}`;

        await this.storage.uploadFile(storageKey, file.buffer, file.mimetype);

        let thumbKey: string | null = null;
        if (file.mimetype.startsWith('image/')){
            const thumbBuffer = await sharp(file.buffer).resize(200,200,{fit:'inside'}).toBuffer();
            thumbKey = `channels/${channelId}/${fileId}-thumb.jpg`;
            await this.storage.uploadFile(thumbKey, thumbBuffer, 'image/jpg');
        }
        return this.prisma.attachments.create({
            data:{
                uploaderId,
                fileName: file.originalname,
                mime: file.mimetype,
                size: file.size,
                storageKey,
                thumbKey,
            }
        })
    }

    async getDownloadFile(attachmentsId: string){
        const attachment = await this.prisma.attachments.findUnique({
            where:{id: attachmentsId},
        });
        if (!attachment){
            throw new BadRequestException('attachment not found');
        }
        return this.storage.getDownloadUrl(attachment.storageKey);
    }
}