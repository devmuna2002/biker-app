import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Trip, TripStatus } from './trip.entity';
import { OsrmService } from '../routing/osrm.service';

export interface CalculateTripDto {
    customer_id: string;
    pickup_lat: number;
    pickup_lng: number;
    dropoff_lat: number;
    dropoff_lng: number;
    pickup_location_name?: string;
    dropoff_location_name?: string;
    customer_offer?: number;
}

export interface CreateTripResult {
    trip_id: string;
    distance_km: number;
    estimated_duration_min: number;
    min_fare: number;
    final_price: number;
    route_polyline: string;
}

@Injectable()
export class TripsService {
    private readonly logger = new Logger(TripsService.name);

    constructor(
        @InjectRepository(Trip)
        private tripsRepository: Repository<Trip>,
        private osrmService: OsrmService,
    ) {}

    async calculateTrip(dto: CalculateTripDto): Promise<CreateTripResult> {
        try {
            // Get route using OSRM
            const route = await this.osrmService.getRoute(
                dto.pickup_lat,
                dto.pickup_lng,
                dto.dropoff_lat,
                dto.dropoff_lng
            );

            // Calculate minimum fare
            const min_fare = this.calculateMinFare(route.distance_km);
            
            // Determine final price (customer offer or minimum fare)
            let final_price = min_fare;
            if (dto.customer_offer && dto.customer_offer >= min_fare) {
                final_price = dto.customer_offer;
            } else if (dto.customer_offer && dto.customer_offer < min_fare) {
                throw new Error(`Customer offer too low. Minimum fare is ${min_fare}`);
            }

            // Create trip record
            const trip = this.tripsRepository.create({
                customer_id: dto.customer_id,
                pickup_latitude: dto.pickup_lat,
                pickup_longitude: dto.pickup_lng,
                dropoff_latitude: dto.dropoff_lat,
                dropoff_longitude: dto.dropoff_lng,
                pickup_location_name: dto.pickup_location_name,
                dropoff_location_name: dto.dropoff_location_name,
                customer_offer: dto.customer_offer,
                route_polyline: route.polyline,
                calculated_distance_km: route.distance_km,
                estimated_duration_min: route.duration_min,
                min_fare: min_fare,
                final_price: final_price,
                status: TripStatus.REQUESTED,
            });

            const savedTrip = await this.tripsRepository.save(trip);

            return {
                trip_id: savedTrip.trip_id,
                distance_km: route.distance_km,
                estimated_duration_min: route.duration_min,
                min_fare: min_fare,
                final_price: final_price,
                route_polyline: route.polyline,
            };
        } catch (error) {
            this.logger.error(`Calculate trip error: ${error.message}`);
            throw error;
        }
    }

    async startTrip(trip_id: string, rider_id: string): Promise<Trip> {
        const trip = await this.tripsRepository.findOne({ where: { trip_id } });
        if (!trip) {
            throw new Error('Trip not found');
        }

        trip.rider_id = rider_id;
        trip.status = TripStatus.STARTED;
        trip.started_at = new Date();

        return this.tripsRepository.save(trip);
    }

    async completeTrip(trip_id: string): Promise<{ rider_amount: number; commission: number }> {
        const trip = await this.tripsRepository.findOne({ where: { trip_id } });
        if (!trip) {
            throw new Error('Trip not found');
        }

        trip.status = TripStatus.COMPLETED;
        trip.completed_at = new Date();
        await this.tripsRepository.save(trip);

        // Calculate commission (15%)
        const final_price = Number(trip.final_price);
        const commission = Number((final_price * 0.15).toFixed(2));
        const rider_amount = Number((final_price - commission).toFixed(2));

        return { rider_amount, commission };
    }

    async cancelTrip(
        trip_id: string,
        cancelled_by: 'customer' | 'rider',
        reason?: string
    ): Promise<Trip> {
        const trip = await this.tripsRepository.findOne({ where: { trip_id } });
        if (!trip) {
            throw new Error('Trip not found');
        }

        trip.status = TripStatus.CANCELLED;
        trip.cancelled_at = new Date();
        trip.cancelled_by = cancelled_by;
        trip.cancellation_reason = reason;

        return this.tripsRepository.save(trip);
    }

    async getTripById(trip_id: string): Promise<Trip> {
        return this.tripsRepository.findOne({ where: { trip_id } });
    }

    async getCustomerTrips(customer_id: string): Promise<Trip[]> {
        return this.tripsRepository.find({
            where: { customer_id },
            order: { created_at: 'DESC' },
        });
    }

    async getRiderTrips(rider_id: string): Promise<Trip[]> {
        return this.tripsRepository.find({
            where: { rider_id },
            order: { created_at: 'DESC' },
        });
    }

    async getPendingTrips(): Promise<Trip[]> {
        return this.tripsRepository.find({
            where: { status: TripStatus.REQUESTED },
            order: { requested_at: 'ASC' },
        });
    }

    async acceptTrip(trip_id: string, rider_id: string): Promise<Trip> {
        const trip = await this.tripsRepository.findOne({ where: { trip_id } });
        if (!trip) {
            throw new Error('Trip not found');
        }

        trip.rider_id = rider_id;
        trip.status = TripStatus.ACCEPTED;
        trip.accepted_at = new Date();

        return this.tripsRepository.save(trip);
    }

    private calculateMinFare(distance_km: number): number {
        return Number((distance_km / 1.3).toFixed(2));
    }
}
