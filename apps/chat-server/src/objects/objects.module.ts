import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ObjectsService } from './objects.service';

@Module({
  imports: [HttpModule],
  providers: [ObjectsService],
  exports: [ObjectsService],
})
export class ObjectsModule {}
