import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  async check() {
    const [db, storage] = await Promise.all([
      this.checkDb(),
      this.checkStorage(),
    ]);
    const status = db.ok && storage.ok ? 'ok' : 'degraded';
    return { status, db, storage };
  }

  private async checkDb() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'unknown error',
      };
    }
  }

  private async checkStorage() {
    try {
      await this.storage.checkConnection();
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'unknown error',
      };
    }
  }
}
