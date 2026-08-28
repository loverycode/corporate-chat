import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SearchService } from './search.service';
import { CurrentUser } from '../auth/current-user.decorator';
import type { UsersCache } from '@prisma/client';
@UseGuards(JwtAuthGuard)
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}
  @Get()
  search(
    @Query('q') query: string,
    @Query('channelId') channelId: string | undefined,
    @CurrentUser() user: UsersCache,
  ) {
    if (!query.trim() || query.trim().length === 0) {
      return [];
    }
    return this.searchService.search(user.id, query.trim(), channelId);
  }
}
