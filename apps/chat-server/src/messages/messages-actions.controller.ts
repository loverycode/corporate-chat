import { CurrentUser } from '../auth/current-user.decorator';
import type { UsersCache } from '@prisma/client';
import {
  Patch,
  Delete,
  Controller,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MessagesService } from './message.service';
import { UpdateMessageDto } from './update-message.dto';

@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessageActionsController {
  constructor(private readonly messagesService: MessagesService) {}
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMessageDto,
    @CurrentUser() user: UsersCache,
  ) {
    return this.messagesService.update(id, dto, user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: UsersCache) {
    return this.messagesService.remove(id, user.id);
  }
}
