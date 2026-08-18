import {Controller, Get, Req, UseGuards} from "@nestjs/common";
import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import { ChannelsService } from "./channels.service";

@UseGuards(JwtAuthGuard)
@Controller('unread-summary')
export class UnreadController{
    constructor(private readonly channelsService: ChannelsService){}
    @Get()
    get(@Req() req){
        return this.channelsService.getUnreadSummary(req.user.id);
    }
}