import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ObjectsController } from './objects.controller';
import { JwtModule } from '@nestjs/jwt';
import {ServeStaticModule} from '@nestjs/serve-static';
import {join} from 'path';

@Module({
    imports: [JwtModule.register({}), ServeStaticModule.forRoot({rootPath: join(__dirname, '..', 'src', 'public')})],
    controllers: [AppController, ObjectsController],
})
export class AppModule {}