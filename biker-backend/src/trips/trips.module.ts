import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';
import { Trip } from './trip.entity';
import { RoutingModule } from '../routing/routing.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Trip]),
        RoutingModule,
    ],
    controllers: [TripsController],
    providers: [TripsService],
    exports: [TripsService],
})
export class TripsModule {}
