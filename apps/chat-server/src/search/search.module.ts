import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  controllers: [SearchController],
  imports: [PrismaModule],
  providers: [SearchService],
})
export class SearchModule {}
