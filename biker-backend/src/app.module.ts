import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { UsersModule } from './users/users.module';
import { BikersModule } from './bikers/bikers.module';
import { OrdersModule } from './orders/orders.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SafetyModule } from './safety/safety.module';
import { SupportModule } from './support/support.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { DashboardModule } from './dashboard/dashboard.module';
import { LocationModule } from './location/location.module';
import { PricingModule } from './pricing/pricing.module';
import { ServiceCatalogModule } from './service-catalog/service-catalog.module';
import { ZonesModule } from './zones/zones.module';
import { TrackingModule } from './tracking/tracking.module';
import { DriversModule } from './drivers/drivers.module';
import { QueuesModule } from './queues/queues.module';
import { HealthController } from './health.controller';
import { DriverModule } from './driver/driver.module';
import { RoutesModule } from './routes/routes.module';
import { ChatModule } from './chat/chat.module';
import { AdminModule } from './admin/admin.module';
import { TripsModule } from './trips/trips.module';
import { WalletModule } from './wallet/wallet.module';
import { PaymentsModule } from './payments/payments.module';
import { RoutingModule } from './routing/routing.module';
import { CallsController } from './controllers/calls.controller';

@Module({
    imports: [
        TypeOrmModule.forRoot({
            type: 'postgres',
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT) || 5432,
            username: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || 'password',
            database: process.env.DB_NAME || 'biker_db',
            autoLoadEntities: true,
            synchronize:
                process.env.NODE_ENV === 'production'
                    ? false
                    : process.env.TYPEORM_SYNC
                        ? process.env.TYPEORM_SYNC === 'true'
                        : true,
            ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
            logging: process.env.TYPEORM_LOGGING === 'true',
        }),
        AuthModule,
        UsersModule,
        BikersModule,
        OrdersModule,
        NotificationsModule,
        SafetyModule,
        SupportModule,
        ServiceCatalogModule,
        ZonesModule,
        LocationModule,
        PricingModule,
        DashboardModule,
        TrackingModule,
        DriversModule,
        QueuesModule,
        DriverModule,
        RoutesModule,
        ChatModule,
        AdminModule,
        TripsModule,
        WalletModule,
        PaymentsModule,
        RoutingModule,
    ],
    controllers: [HealthController, CallsController],
    providers: [
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
    ],
})
export class AppModule { }
