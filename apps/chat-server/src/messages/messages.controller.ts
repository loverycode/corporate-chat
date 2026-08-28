import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { UsersCache } from '@prisma/client';
import {
  Post,
  Controller,
  Get,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { CreateMessageDto } from './create-message.dto';
import { MessagesService } from './message.service';
import { Throttle } from '@nestjs/throttler';
@UseGuards(JwtAuthGuard)
@Controller('channels/:channelId/messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post()
  create(
    @Param('channelId') channelId: string,
    @Body() dto: CreateMessageDto,
    @CurrentUser() user: UsersCache,
  ) {
    return this.messagesService.create(channelId, dto, user.id);
  }

  @Get()
  findHistory(
    @Param('channelId') channelId: string,
    @CurrentUser() user: UsersCache,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.messagesService.findHistory(
      channelId,
      user.id,
      cursor,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Get(':messageId/position')
  findPosition(
    @Param('channelId') channelId: string,
    @Param('messageId') messageId: string,
    @CurrentUser() user: UsersCache,
  ) {
    return this.messagesService.findMessagePosition(
      channelId,
      user.id,
      messageId,
    );
  }
}
