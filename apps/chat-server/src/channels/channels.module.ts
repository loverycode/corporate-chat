import { Module } from '@nestjs/common';
import { ChannelsService } from './channels.service';
import { ChannelsController } from './channels.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { UnreadController } from './unread.controller';
import { MessagesModule } from 'src/messages/messages.module';

@Module({
    imports:[PrismaModule, MessagesModule],
    controllers: [ChannelsController, UnreadController],
    providers: [ChannelsService],
    exports: [ChannelsService],
})
export class ChannelsModule {}
