import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';

export enum TripStatus {
    REQUESTED = 'requested',
    ACCEPTED = 'accepted',
    STARTED = 'started',
    COMPLETED = 'completed',
    CANCELLED = 'cancelled',
}

@Entity('trips')
export class Trip {
    @PrimaryGeneratedColumn('uuid')
    trip_id: string;

    @Column({ name: 'customer_id', type: 'uuid', nullable: true })
    customer_id: string;

    @Column({ name: 'rider_id', type: 'uuid', nullable: true })
    rider_id: string;

    @Column({ name: 'pickup_location_name', type: 'text', nullable: true })
    pickup_location_name: string;

    @Column({ name: 'pickup_address', type: 'text', nullable: true })
    pickup_address: string;

    @Column({ name: 'pickup_latitude', type: 'decimal', precision: 10, scale: 8 })
    pickup_latitude: number;

    @Column({ name: 'pickup_longitude', type: 'decimal', precision: 11, scale: 8 })
    pickup_longitude: number;

    @Column({ name: 'dropoff_location_name', type: 'text', nullable: true })
    dropoff_location_name: string;

    @Column({ name: 'dropoff_address', type: 'text', nullable: true })
    dropoff_address: string;

    @Column({ name: 'dropoff_latitude', type: 'decimal', precision: 10, scale: 8 })
    dropoff_latitude: number;

    @Column({ name: 'dropoff_longitude', type: 'decimal', precision: 11, scale: 8 })
    dropoff_longitude: number;

    @Column({ name: 'route_polyline', type: 'text', nullable: true })
    route_polyline: string;

    @Column({ name: 'calculated_distance_km', type: 'decimal', precision: 10, scale: 2, nullable: true })
    calculated_distance_km: number;

    @Column({ name: 'estimated_duration_min', type: 'int', nullable: true })
    estimated_duration_min: number;

    @Column({ name: 'customer_offer', type: 'decimal', precision: 10, scale: 2, nullable: true })
    customer_offer: number;

    @Column({ name: 'rider_offer', type: 'decimal', precision: 10, scale: 2, nullable: true })
    rider_offer: number;

    @Column({ name: 'min_fare', type: 'decimal', precision: 10, scale: 2, nullable: true })
    min_fare: number;

    @Column({ name: 'final_price', type: 'decimal', precision: 10, scale: 2, nullable: true })
    final_price: number;

    @Column({ type: 'varchar', length: 20, default: TripStatus.REQUESTED })
    status: TripStatus;

    @Column({ name: 'requested_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    requested_at: Date;

    @Column({ name: 'accepted_at', type: 'timestamp', nullable: true })
    accepted_at: Date;

    @Column({ name: 'started_at', type: 'timestamp', nullable: true })
    started_at: Date;

    @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
    completed_at: Date;

    @Column({ name: 'cancelled_at', type: 'timestamp', nullable: true })
    cancelled_at: Date;

    @Column({ name: 'cancelled_by', type: 'varchar', length: 20, nullable: true })
    cancelled_by: string;

    @Column({ name: 'cancellation_reason', type: 'text', nullable: true })
    cancellation_reason: string;

    @Column({ name: 'customer_rating', type: 'int', nullable: true })
    customer_rating: number;

    @Column({ name: 'customer_review', type: 'text', nullable: true })
    customer_review: string;

    @Column({ name: 'rider_rating', type: 'int', nullable: true })
    rider_rating: number;

    @Column({ name: 'rider_review', type: 'text', nullable: true })
    rider_review: string;

    @CreateDateColumn({ name: 'created_at' })
    created_at: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updated_at: Date;
}
