import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Post, Controller, Get, Param, Query, Req, Body, UseGuards } from "@nestjs/common";
import { CreateMessageDto } from "./create-message.dto";
import { MessagesService } from "./message.service";

@UseGuards(JwtAuthGuard)
@Controller('channels/:channelId/messages')
export class MessagesController{
    constructor(private readonly messagesService: MessagesService){}
    @Post()
     create(
        @Param('channelId') channelId: string,
        @Body() dto: CreateMessageDto,
        @Req() req,
     ){
        return this.messagesService.create(channelId, dto, req.user.id )
     }

     @Get()
     findHistory(
        @Param('channelId') channelId: string,
        @Req() req,
        @Query('cursor') cursor?: string,
        @Query('limit') limit?: string,
     ){
        return this.messagesService.findHistory(channelId, req.user.id, cursor, limit ? parseInt(limit, 10): undefined);
     }
}
