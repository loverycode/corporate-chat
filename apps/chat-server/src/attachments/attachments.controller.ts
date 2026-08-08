import { Controller, Post, Get, Res, Req, Param, UseGuards, UseInterceptors, UploadedFile } from "@nestjs/common";
import { AttachmentsService } from "./attachments.service";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { JwtAuthGuard } from "src/auth/jwt-auth.guard";

@UseGuards(JwtAuthGuard)
@Controller('channels/:channelId/attachments')
export class AttachmentsController{
    constructor(private readonly attachmentsService: AttachmentsService){};
    @Post()
    @UseInterceptors(FileInterceptor('file'))
    async upload(@UploadedFile() file: Express.Multer.File, @Param('channelId') channelId: string, @Req() req){
        return this.attachmentsService.uploadFile(file, req.user.id, channelId);
    }
}

@UseGuards(JwtAuthGuard)
@Controller('attachments')
export class AttachmentDownloadController{
    constructor( private readonly attachmentsService: AttachmentsService){}
    
    @Get(':id/download')
    async download(@Param('id') id: string, @Res() res: Response){
        const url = await this.attachmentsService.getDownloadFile(id);
        res.redirect(url);
    }
}

