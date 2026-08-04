import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ObjectsController } from './objects.controller';
import { JwtModule } from '@nestjs/jwt';

@Module({
    imports: [JwtModule.register({})],
    controllers: [AppController, ObjectsController],
})
export class AppModule {}