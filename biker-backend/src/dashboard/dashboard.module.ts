import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrdersModule } from '../orders/orders.module';
import { SavedLocation } from '../location/saved-location.entity';
import { BikersModule } from '../bikers/bikers.module';
import { ZonesModule } from '../zones/zones.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
    imports: [
        UsersModule,
        NotificationsModule,
        OrdersModule,
        TypeOrmModule.forFeature([SavedLocation]),
        BikersModule,
        ZonesModule,
        RealtimeModule,
    ],
    controllers: [DashboardController],
    providers: [DashboardService],
})
export class DashboardModule {}
