import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { Rider } from './admin.entity';
import { Trip } from '../trips/trip.entity';
import { Wallet } from '../wallet/wallet.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([Rider, Trip, Wallet]),
    ],
    controllers: [AdminController],
    providers: [AdminService],
    exports: [AdminService],
})
export class AdminModule {}
