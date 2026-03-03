import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Rider, RiderStatus } from './admin.entity';
import { Trip, TripStatus } from '../trips/trip.entity';
import { Wallet } from '../wallet/wallet.entity';
import { WalletUserType } from '../wallet/wallet.entity';

export interface DashboardStats {
    total_riders: number;
    active_riders: number;
    total_customers: number;
    total_trips: number;
    completed_trips: number;
    total_earnings: number;
    pending_earnings: number;
}

export interface TripWithDetails extends Trip {
    customer_name?: string;
    rider_name?: string;
}

@Injectable()
export class AdminService {
    private readonly logger = new Logger(AdminService.name);

    constructor(
        @InjectRepository(Rider)
        private riderRepository: Repository<Rider>,
        @InjectRepository(Trip)
        private tripRepository: Repository<Trip>,
        @InjectRepository(Wallet)
        private walletRepository: Repository<Wallet>,
    ) {}

    async getDashboardStats(): Promise<DashboardStats> {
        const total_riders = await this.riderRepository.count();
        const active_riders = await this.riderRepository.count({
            where: { is_online: true },
        });

        // Get customer count from customers table
        const total_customers = 0; // Would need customer repository

        const total_trips = await this.tripRepository.count();
        const completed_trips = await this.tripRepository.count({
            where: { status: TripStatus.COMPLETED },
        });

        // Get total earnings from admin wallet
        const adminWallet = await this.walletRepository.findOne({
            where: { user_type: WalletUserType.ADMIN },
        });

        return {
            total_riders,
            active_riders,
            total_customers,
            total_trips,
            completed_trips,
            total_earnings: adminWallet ? Number(adminWallet.balance) : 0,
            pending_earnings: 0,
        };
    }

    async getAllRiders(status?: RiderStatus): Promise<Rider[]> {
        const where: any = {};
        if (status) {
            where.status = status;
        }
        
        return this.riderRepository.find({
            where,
            order: { created_at: 'DESC' },
        });
    }

    async approveRider(rider_id: string): Promise<Rider> {
        const rider = await this.riderRepository.findOne({ where: { rider_id } });
        if (!rider) {
            throw new Error('Rider not found');
        }

        rider.status = RiderStatus.APPROVED;
        rider.id_document_verified = true;
        
        return this.riderRepository.save(rider);
    }

    async rejectRider(rider_id: string, reason: string): Promise<Rider> {
        const rider = await this.riderRepository.findOne({ where: { rider_id } });
        if (!rider) {
            throw new Error('Rider not found');
        }

        rider.status = RiderStatus.REJECTED;
        
        return this.riderRepository.save(rider);
    }

    async suspendRider(rider_id: string): Promise<Rider> {
        const rider = await this.riderRepository.findOne({ where: { rider_id } });
        if (!rider) {
            throw new Error('Rider not found');
        }

        rider.status = RiderStatus.SUSPENDED;
        rider.is_online = false;
        rider.is_available = false;
        
        return this.riderRepository.save(rider);
    }

    async getAllTrips(limit: number = 50, offset: number = 0): Promise<TripWithDetails[]> {
        const trips = await this.tripRepository.find({
            order: { created_at: 'DESC' },
            take: limit,
            skip: offset,
        });

        // Could join with rider and customer tables for more details
        return trips as TripWithDetails[];
    }

    async getTripById(trip_id: string): Promise<TripWithDetails> {
        return this.tripRepository.findOne({ where: { trip_id } }) as Promise<TripWithDetails>;
    }

    async getRiderEarnings(rider_id: string): Promise<number> {
        const rider = await this.riderRepository.findOne({ where: { rider_id } });
        if (!rider) {
            throw new Error('Rider not found');
        }

        const wallet = await this.walletRepository.findOne({
            where: { user_id: rider_id, user_type: WalletUserType.RIDER },
        });

        return wallet ? Number(wallet.balance) : 0;
    }

    async getTotalEarnings(): Promise<number> {
        const adminWallet = await this.walletRepository.findOne({
            where: { user_type: WalletUserType.ADMIN },
        });

        return adminWallet ? Number(adminWallet.balance) : 0;
    }
}
