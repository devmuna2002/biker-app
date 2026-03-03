import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DriverController } from './driver.controller';
import { DriverService } from './driver.service';
import { Biker } from '../bikers/biker.entity';
import { Order } from '../orders/order.entity';
import { TrackingSession } from '../tracking/tracking-session.entity';
import { RealtimeModule } from '../realtime/realtime.module';

import { BikerLocation } from '../tracking/biker-location.entity';
import { TrackingModule } from '../tracking/tracking.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Biker, Order, TrackingSession, BikerLocation]),
        RealtimeModule,
        TrackingModule,
    ],
    controllers: [DriverController],
    providers: [DriverService],
})
export class DriverModule { }
