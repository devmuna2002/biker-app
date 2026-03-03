import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn, Index, UpdateDateColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { Biker } from '../bikers/biker.entity';

export enum OrderStatus {
    DRAFT = 'draft',
    PENDING_BIDS = 'pending_bids',
    ASSIGNED = 'assigned',
    PICKED_UP = 'picked_up',
    IN_TRANSIT = 'in_transit',
    COMPLETED = 'completed',
    CANCELLED = 'cancelled',
}

export enum ServiceType {
    BIKE = 'bike',
    COURIER = 'courier',
    LOCAL_SERVICES = 'local_services',
}

export enum OrderType {
    LOCAL = 'local',
    COURIER = 'courier',
    INTERCITY = 'intercity',
}

export enum PackageCategory {
    SMALL = 'small',
    MEDIUM = 'medium',
    LARGE = 'large',
}

@Entity('orders')
export class Order {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => User)
    user: User;

    @ManyToOne(() => Biker, { nullable: true })
    biker: Biker;

    @Index({ spatial: true })
    @Column({
        type: 'geometry',
        spatialFeatureType: 'Point',
        srid: 4326,
        nullable: true,
    })
    pickupLocation: any;

    @Index({ spatial: true })
    @Column({
        type: 'geometry',
        spatialFeatureType: 'Point',
        srid: 4326,
        nullable: true,
    })
    dropoffLocation: any;

    @Column({ nullable: true })
    pickupAddress: string;

    @Column({ nullable: true })
    dropoffAddress: string;

    @Column({ type: 'text', nullable: true })
    packageDescription: string;

    // Legacy float field kept for compatibility; prefer cents fields.
    @Column({ type: 'float', default: 0 })
    suggestedPrice: number;

    @Column({ type: 'int', default: 0 })
    suggestedPriceCents: number;

    @Column({ type: 'float', nullable: true })
    finalPrice: number;

    @Column({ type: 'int', nullable: true })
    finalPriceCents: number | null;

    @Column({
        type: 'enum',
        enum: ServiceType,
        default: ServiceType.BIKE,
    })
    serviceType: ServiceType;

    @Column({ type: 'float', nullable: true })
    distanceKm: number | null;

    @Column({ type: 'int', nullable: true })
    etaMinutes: number | null;

    @Column({ type: 'float', nullable: true })
    packageWeightKg: number | null;

    // Payment tracking
    @Column({ type: 'varchar', length: 50, nullable: true })
    paymentMethod: string; // cash, mobile_money, paypal

    @Column({ type: 'varchar', length: 50, default: 'pending' })
    paymentStatus: string; // pending, completed, failed

    @Column({ type: 'float', nullable: true })
    packageVolumeM3: number | null;

    @Column({
        type: 'enum',
        enum: OrderStatus,
        default: OrderStatus.PENDING_BIDS,
    })
    status: OrderStatus;

    @Column({
        type: 'enum',
        enum: OrderType,
        default: OrderType.LOCAL,
    })
    orderType: OrderType;

    @Column({
        type: 'enum',
        enum: PackageCategory,
        nullable: true,
    })
    packageCategory: PackageCategory;

    @Column({ type: 'timestamp', nullable: true })
    intercityDate: Date;

    @Column({ type: 'int', nullable: true })
    passengerCount: number;

    @Column({ nullable: true })
    pickupCode: string;

    @Column({ nullable: true })
    deliveryCode: string;

    @Column({ type: 'text', nullable: true })
    routePolyline: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
