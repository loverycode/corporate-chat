import { Module } from '@nestjs/common';
import { ChannelsService } from './channels.service';
import { ChannelsController, PresenceController } from './channels.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { UnreadController } from './unread.controller';
import { MessagesModule } from '../messages/messages.module';
import { EVENTS_PUBLISHER } from '../events/events-publisher.interface';
import { MessagesGateway } from '../messages/messages.gateway';
@Module({
  imports: [PrismaModule, MessagesModule],
  controllers: [ChannelsController, UnreadController, PresenceController],
  providers: [ChannelsService, {
      provide: EVENTS_PUBLISHER,
      useExisting: MessagesGateway, 
    },],
  exports: [ChannelsService],
})
export class ChannelsModule {}
