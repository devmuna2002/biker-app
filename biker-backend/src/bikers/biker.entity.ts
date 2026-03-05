import { Entity, Column, PrimaryGeneratedColumn, OneToOne, JoinColumn, Index, UpdateDateColumn } from 'typeorm';
import { User } from '../users/user.entity';

export enum DriverVehicleType {
    BIKE = 'bike',
    COURIER = 'courier',
    LOCAL_SERVICES = 'local_services',
}

@Entity('bikers')
export class Biker {
    @PrimaryGeneratedColumn()
    id: number;

    @OneToOne(() => User, user => user.biker)
    @JoinColumn()
    user: User;

    @Column({ nullable: true })
    vehicleDetails: string;

    @Column({
        type: 'enum',
        enum: DriverVehicleType,
        default: DriverVehicleType.BIKE,
    })
    vehicleType: DriverVehicleType;

    @Column({ nullable: true })
    vehicleNumber: string;

    @Column({ default: 'pending' })
    verificationStatus: string;

    // Payment preferences & info
    @Column({ type: 'varchar', length: 50, nullable: true })
    paymentMethodPreference: string; // cash, mobile_money, paypal

    @Column({ type: 'varchar', length: 50, nullable: true })
    mobileMoneyNumber: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    paypalEmail: string;

    @Column({ type: 'varchar', length: 50, default: 'inactive' })
    subscriptionStatus: string; // active, inactive

    @Column({ type: 'date', nullable: true })
    subscriptionExpiryDate: Date;

    @Column({ type: 'date', nullable: true })
    trialExpiryDate: Date;

    @Index({ spatial: true })
    @Column({
        type: 'geometry',
        spatialFeatureType: 'Point',
        srid: 4326,
        nullable: true,
    })
    lastKnownLocation: any;

    @Column({ nullable: true })
    currentDestination: string;

    @Column({ default: false })
    isOnline: boolean;

    @Column({ default: false })
    isAvailable: boolean;

    @Column({ type: 'json', nullable: true })
    serviceCapabilities: {
        bike?: boolean;
        courier?: boolean;
        local_services?: boolean;
        maxWeightKg?: number;
        maxVolumeM3?: number;
    } | null;

    @Column({ default: false })
    hasIntercityPermit: boolean;

    @Column({ default: false })
    isCourierActive: boolean;

    @Column({ type: 'text', nullable: true })
    licenseVerificationPhoto: string;

    @UpdateDateColumn()
    updatedAt: Date;
}
