import { Module } from "@nestjs/common";
import { AttachmentsService } from "./attachments.service";
import { AttachmentDownloadController, AttachmentsController } from "./attachments.controller";
import { PrismaModule } from "src/prisma/prisma.module";
import { StorageModule } from "src/storage/storage.module";
import {MulterModule} from '@nestjs/platform-express';
import { memoryStorage } from "multer";
@Module({
    imports:[PrismaModule, StorageModule, MulterModule.register({storage: memoryStorage()})],
    controllers:[AttachmentDownloadController, AttachmentsController],
    providers:[AttachmentsService],
    exports:[AttachmentsService],
})
export class AttachmentsModule{};