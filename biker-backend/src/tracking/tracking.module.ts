import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrackingGateway } from './tracking.gateway';
import { TrackingSession } from './tracking-session.entity';
import { TrackingLog } from './tracking-log.entity';
import { TrackingService } from './tracking.service';
import { QueuesModule } from '../queues/queues.module';
import { AuthModule } from '../auth/auth.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { Order } from '../orders/order.entity';
import { Biker } from '../bikers/biker.entity';
import { GpsSpoofService } from './gps-spoof.service';
import { BikerLocation } from './biker-location.entity';
import { BikerLocationService } from './biker-location.service';
import { BikerLocationController } from './biker-location.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([TrackingSession, TrackingLog, Order, Biker, BikerLocation]),
        QueuesModule,
        AuthModule,
        RealtimeModule,
    ],
    providers: [TrackingGateway, TrackingService, GpsSpoofService, BikerLocationService],
    controllers: [BikerLocationController],
    exports: [TrackingService, BikerLocationService],
})
export class TrackingModule {}
