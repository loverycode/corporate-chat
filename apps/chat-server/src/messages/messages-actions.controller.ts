import {Patch, Delete, Controller, Param, Body, Req, UseGuards} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { MessagesService } from "./message.service";
import { UpdateMessageDto } from "./update-message.dto";

@UseGuards(JwtAuthGuard)
@Controller('messages')

export class MessageActionsController{
    constructor(private readonly messagesService: MessagesService){}
    @Patch(':id')
    update(@Param('id') id: string, @Body() dto: UpdateMessageDto, @Req() req){
        return this.messagesService.update(id, dto, req.user.id);
    }

    @Delete(':id')
    remove(@Param('id') id: string, @Req() req){
        return this.messagesService.remove(id, req.user.id);
    }
}