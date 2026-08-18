import { Module } from '@nestjs/common';
import { MessagesService } from './message.service';
import { MessagesController } from './messages.controller';
import { MessagesGateway } from './messages.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { ObjectsModule } from 'src/objects/objects.module';
import { MessageActionsController } from './messages-actions.controller';

@Module({
    imports: [
        PrismaModule,
        JwtModule.register({}),
        ObjectsModule,
    ],
    controllers: [MessagesController, MessageActionsController],
    providers: [MessagesService, MessagesGateway],
    exports: [MessagesService, MessagesGateway],
})
export class MessagesModule {}