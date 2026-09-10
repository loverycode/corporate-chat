import { Module } from '@nestjs/common';
import { MessagesService } from './message.service';
import { MessagesController } from './messages.controller';
import { MessagesGateway } from './messages.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { ObjectsModule } from '../objects/objects.module';
import { MessageActionsController } from './messages-actions.controller';
import { EventsModule } from '../events/events.module';
import { EVENTS_PUBLISHER } from '../events/events-publisher.interface';
@Module({
  imports: [PrismaModule, JwtModule.register({}), ObjectsModule, EventsModule],
  controllers: [MessagesController, MessageActionsController],
  providers: [
    MessagesService,
    MessagesGateway,
    {
      provide: EVENTS_PUBLISHER,
      useExisting: MessagesGateway,
    },
  ],
  exports: [MessagesService, MessagesGateway, EVENTS_PUBLISHER],
})
export class MessagesModule {}
