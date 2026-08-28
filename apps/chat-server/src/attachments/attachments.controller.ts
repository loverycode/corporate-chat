import {
  Controller,
  Post,
  Get,
  Res,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { AttachmentsService } from './attachments.service';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/current-user.decorator';
import type { UsersCache } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('channels/:channelId/attachments')
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Param('channelId') channelId: string,
    @CurrentUser() user: UsersCache,
  ) {
    return this.attachmentsService.uploadFile(file, user.id, channelId);
  }
}

@UseGuards(JwtAuthGuard)
@Controller('attachments')
export class AttachmentDownloadController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Get(':id/download')
  async download(@Param('id') id: string, @Res() res: Response) {
    const url = await this.attachmentsService.getDownloadFile(id);
    res.redirect(url);
  }
}
