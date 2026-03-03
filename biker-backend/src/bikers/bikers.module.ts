import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Biker } from './biker.entity';
import { BikersService } from './bikers.service';
import { BikersController } from './bikers.controller';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
    imports: [TypeOrmModule.forFeature([Biker]), RealtimeModule],
    providers: [BikersService],
    controllers: [BikersController],
    exports: [BikersService],
})
export class BikersModule { }
