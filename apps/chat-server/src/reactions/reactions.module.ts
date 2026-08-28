import { Module } from '@nestjs/common';
import { ReactionsService } from './reactions.service';
import { MessagesModule } from 'src/messages/messages.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ReactionsController } from './reactions.controller';

@Module({
  imports: [PrismaModule, MessagesModule],
  controllers: [ReactionsController],
  providers: [ReactionsService],
  exports: [ReactionsService],
})
export class ReactionsModule {}
