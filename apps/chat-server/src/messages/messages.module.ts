import { Module } from '@nestjs/common';
import { MessagesService } from './message.service';
import { MessagesController } from './messages.controller';
import { MessagesGateway } from './messages.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { ObjectsModule } from 'src/objects/objects.module';
import { MessageActionsController } from './messages-actions.controller';
import { EventsModule } from 'src/events/events.module';
@Module({
  imports: [PrismaModule, JwtModule.register({}), ObjectsModule, EventsModule],
  controllers: [MessagesController, MessageActionsController],
  providers: [MessagesService, MessagesGateway],
  exports: [MessagesService, MessagesGateway],
})
export class MessagesModule {}
