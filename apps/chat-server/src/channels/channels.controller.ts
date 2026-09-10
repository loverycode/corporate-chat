import { Controller, Post, Get, Body, Param, UseGuards, Put, Delete, Patch} from '@nestjs/common';
import { CreateChannelDto } from './create-channel.dto';
import { ChannelsService } from './channels.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MessagesGateway } from '../messages/messages.gateway';
import { CurrentUser } from '../auth/current-user.decorator';
import type { UsersCache } from '@prisma/client';
import { UpdateChannelDto } from './update-channel.dto';

@UseGuards(JwtAuthGuard)
@Controller('channels')
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}
  @Post()
  create(@Body() dto: CreateChannelDto, @CurrentUser() user: UsersCache) {
    return this.channelsService.create(dto, user.id);
  }
  @Get()
  findAll(@CurrentUser() user: UsersCache) {
    return this.channelsService.findUserChannels(user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: UsersCache) {
    return this.channelsService.findById(id, user.id);
  }
  @Delete(':channelId')
  async deleteChannel(@Param('channelId') channelId: string, @CurrentUser() user: UsersCache) {
      return this.channelsService.deleteChannel(channelId, user.id);
  }

  @Put(':id/read-mark')
  markRead(
    @Param('id') channelid: string,
    @Body() body: { messageId: string },
    @CurrentUser() user: UsersCache,
  ) {
    return this.channelsService.markRead(channelid, user.id, body.messageId);
  }
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateChannelDto, @CurrentUser() user: UsersCache) {
      return this.channelsService.update(id, dto, user.id);
  }

  @Post(':id/members')
  addMembers(@Param('id') id: string, @Body() body: { userIds: string[] }, @CurrentUser() user: UsersCache) {
      return this.channelsService.addMembers(id, body.userIds, user.id);
  }

  @Delete(':id/members/:userId')
  removeMember(@Param('id') id: string, @Param('userId') userId: string, @CurrentUser() user: UsersCache) {
      return this.channelsService.removeMember(id, userId, user.id);
  }
}

@UseGuards(JwtAuthGuard)
@Controller('presence')
export class PresenceController {
  constructor(private readonly messagesGateway: MessagesGateway) {}
  @Get()
  getOnlineUsers() {
    return this.messagesGateway.getOnlineUserIds();
  }
}
