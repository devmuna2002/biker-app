import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './order.entity';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { ApiOrdersController } from './api-orders.controller';
import { OrderFlowService } from './order-flow.service';
import { DriverAssignment } from './driver-assignment.entity';
import { OrderItem } from './order-item.entity';
import { Payment } from '../payments/payment.entity';
import { TrackingSession } from '../tracking/tracking-session.entity';
import { TrackingLog } from '../tracking/tracking-log.entity';
import { User } from '../users/user.entity';
import { Biker } from '../bikers/biker.entity';
import { RealtimeModule } from '../realtime/realtime.module';
import { ServiceCatalogModule } from '../service-catalog/service-catalog.module';
import { ZonesModule } from '../zones/zones.module';
import { PricingModule } from '../pricing/pricing.module';
import { QueuesModule } from '../queues/queues.module';
import { SavedLocation } from '../location/saved-location.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([Order, DriverAssignment, OrderItem, Payment, TrackingSession, TrackingLog, User, Biker, SavedLocation]),
        RealtimeModule,
        ServiceCatalogModule,
        ZonesModule,
        PricingModule,
        QueuesModule,
    ],
    providers: [OrdersService, OrderFlowService],
    controllers: [OrdersController, ApiOrdersController],
    exports: [OrdersService, OrderFlowService],
})
export class OrdersModule { }
