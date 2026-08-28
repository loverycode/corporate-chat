import { Controller, Put, Delete, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReactionsService } from './reactions.service';
import { CurrentUser } from '../auth/current-user.decorator';
import type { UsersCache } from '@prisma/client';
@UseGuards(JwtAuthGuard)
@Controller('messages')
export class ReactionsController {
  constructor(private readonly reactionsService: ReactionsService) {}

  @Put(':id/reactions/:emoji')
  addReaction(
    @Param('id') id: string,
    @Param('emoji') emoji: string,
    @CurrentUser() user: UsersCache,
  ) {
    return this.reactionsService.addReaction(
      id,
      user.id,
      decodeURIComponent(emoji),
    );
  }

  @Delete(':id/reactions/:emoji')
  removeReaction(
    @Param('id') id: string,
    @Param('emoji') emoji: string,
    @CurrentUser() user: UsersCache,
  ) {
    return this.reactionsService.removeReaction(
      id,
      user.id,
      decodeURIComponent(emoji),
    );
  }
}
