import { Controller, Post, Get, Body, Param, Req, UseGuards, Put } from "@nestjs/common";
import { CreateChannelDto } from "./create-channel.dto";
import { ChannelsService } from "./channels.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@UseGuards(JwtAuthGuard)
@Controller('channels')
export class ChannelsController{
    constructor(private readonly channelsService: ChannelsService){}
    @Post()
    create(@Body() dto: CreateChannelDto, @Req() req){
        return this.channelsService.create(dto, req.user.id);
    }
    @Get()
    findAll(@Req() req){
        return this.channelsService.findUserChannels(req.user.id);
    }

    @Get(':id')
    findOne(@Param('id') id:string, @Req() req){
        return this.channelsService.findById(id, req.user.id);
    }

    @Put(':id/read-mark')
    markRead(@Param('id') channelid: string, @Body() body:{messageId: string}, @Req() req){
        return this.channelsService.markRead(channelid, req.user.id, body.messageId);
    }
}
