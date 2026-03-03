import { Module } from '@nestjs/common';
import { DriversController } from './drivers.controller';
import { BikersModule } from '../bikers/bikers.module';
import { LocationModule } from '../location/location.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
    imports: [BikersModule, LocationModule, RealtimeModule],
    controllers: [DriversController],
})
export class DriversModule {}
