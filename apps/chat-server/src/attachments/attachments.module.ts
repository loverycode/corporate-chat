import { Module } from '@nestjs/common';
import { AttachmentsService } from './attachments.service';
import { ScheduleModule } from '@nestjs/schedule';
import {
  AttachmentDownloadController,
  AttachmentsController,
} from './attachments.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
@Module({
  imports: [
    PrismaModule,
    StorageModule,
    MulterModule.register({ storage: memoryStorage() }),
    ScheduleModule.forRoot(),
  ],
  controllers: [AttachmentDownloadController, AttachmentsController],
  providers: [AttachmentsService],
  exports: [AttachmentsService],
})
export class AttachmentsModule {}
