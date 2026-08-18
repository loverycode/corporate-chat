import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ChannelsModule } from './channels/channels.module';
import { MessagesModule } from './messages/messages.module';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
import { AttachmentsModule } from './attachments/attachments.module';
import { ReactionsModule } from './reactions/reactions.module';

@Module({
  imports: [PrismaModule, AuthModule, UsersModule, ChannelsModule, MessagesModule, StorageModule, AttachmentsModule, ReactionsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
