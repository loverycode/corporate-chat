import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

interface ResolvedObject {
  id: string;
  exists: boolean;
  canRead: boolean;
  title?: string;
  typeName?: string;
  icon?: string;
  url?: string;
}

interface CacheEntry {
  data: ResolvedObject;
  expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class ObjectsService {
  private readonly logger = new Logger(ObjectsService.name);
  private readonly portalApiUrl =
    process.env.PORTAL_API_URL || 'http://portal-mock:3000';
  private readonly serviceToken = process.env.PORTAL_SERVICE_TOKEN || '';
  private readonly publicUrls = (process.env.PORTAL_PUBLIC_URLS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  private cache = new Map<string, CacheEntry>();

  constructor(private readonly http: HttpService) {}

  extractObjectIds(bodyMd: string): string[] {
    const ids = new Set<string>();
    for (const domain of this.publicUrls) {
      const escaped = domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(
        `${escaped}/dashboard/object/([0-9a-fA-F-]{36})`,
        'g',
      );
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(bodyMd)) !== null) {
        ids.add(match[1]);
      }
    }
    return Array.from(ids);
  }

  async resolveObjects(
    objectIds: string[],
    forUserId: string,
  ): Promise<Map<string, ResolvedObject>> {
    const result = new Map<string, ResolvedObject>();
    const toFetch: string[] = [];

    const now = Date.now();
    for (const id of objectIds) {
      const cacheKey = `${id}:${forUserId}`;
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expiresAt > now) {
        result.set(id, cached.data);
      } else {
        toFetch.push(id);
      }
    }
    if (toFetch.length === 0) {
      return result;
    }
    try {
      const response = await firstValueFrom(
        this.http.post<ResolvedObject[]>(
          `${this.portalApiUrl}/api/integration/chat/objects/resolve`,
          { objectIds: toFetch, forUserId },
          {
            headers: { 'X-Service-Token': this.serviceToken },
            timeout: 3000,
          },
        ),
      );
      for (const obj of response.data) {
        result.set(obj.id, obj);
        this.cache.set(`${obj.id}:${forUserId}`, {
          data: obj,
          expiresAt: now + CACHE_TTL_MS,
        });
      }
    } catch (err) {
      this.logger.warn(
        `Failed to resolve objects: ${err instanceof Error ? err.message : err}`,
      );
    }

    return result;
  }

  async checkAccess(objectId: string, userId: string): Promise<boolean> {
    try {
      const resolved = await this.resolveObjects([objectId], userId);
      const obj = resolved.get(objectId);
      return obj?.canRead ?? false;
    } catch {
      return false;
    }
  }

  async checkAccessBatch(
    objectIds: string[],
    userId: string,
  ): Promise<Map<string, boolean>> {
    const result = new Map<string, boolean>();
    if (objectIds.length === 0) return result;
    try {
      const resolved = await this.resolveObjects(objectIds, userId);
      for (const id of objectIds) {
        result.set(id, resolved.get(id)?.canRead ?? false);
      }
    } catch {
      for (const id of objectIds) {
        result.set(id, false);
      }
    }
    return result;
  }
}
