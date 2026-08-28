import { Module } from '@nestjs/common';
import { InMemoryEventsPublisher } from './in-memory-events-publisher';
@Module({
  providers: [InMemoryEventsPublisher],
  exports: [InMemoryEventsPublisher],
})
export class EventsModule {}
