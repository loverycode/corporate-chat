import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { ChannelsService } from './channels.service';
import { CurrentUser } from '../auth/current-user.decorator';
import type { UsersCache } from '@prisma/client';
@UseGuards(JwtAuthGuard)
@Controller('unread-summary')
export class UnreadController {
  constructor(private readonly channelsService: ChannelsService) {}
  @Get()
  get(@CurrentUser() user: UsersCache) {
    return this.channelsService.getUnreadSummary(user.id);
  }
}
