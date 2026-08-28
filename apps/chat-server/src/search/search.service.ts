import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface SearchResult {
  id: string;
  channelId: string;
  authorId: string;
  bodyMd: string;
  createdAt: Date;
  headline: string;
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(
    userId: string,
    query: string,
    channelId?: string,
  ): Promise<SearchResult[]> {
    const memberships = await this.prisma.channelMembers.findMany({
      where: { userId, ...(channelId ? { channelId } : {}) },
      select: { channelId: true },
    });
    const allowedChannelIds = memberships.map((m) => m.channelId);

    if (allowedChannelIds.length === 0) {
      return [];
    }

    const results = await this.prisma.$queryRaw<SearchResult[]>`
            SELECT id, channel_id AS "channelId", author_id AS "authorId",
                   body_md AS "bodyMd", created_at AS "createdAt", ts_headline('russian', body_md, plainto_tsquery('russian', ${query}), 'StartSel=<mark>, StopSel=</mark>') AS headline
            FROM   messages
            WHERE  channel_id = ANY(${allowedChannelIds}::uuid[]) AND deleted_at IS NULL
                   AND search_vector @@ plainto_tsquery('russian', ${query})
            ORDER BY ts_rank(search_vector, plainto_tsquery('russian', ${query})) DESC
            LIMIT 50
        `;

    return results;
  }
}
