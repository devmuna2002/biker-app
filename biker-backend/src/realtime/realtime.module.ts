import { Module } from '@nestjs/common';
import { DriverLocationCacheService } from '../drivers/driver-location-cache.service';
import { RealtimeEventsService } from './realtime-events.service';

@Module({
    providers: [DriverLocationCacheService, RealtimeEventsService],
    exports: [DriverLocationCacheService, RealtimeEventsService],
})
export class RealtimeModule {}
