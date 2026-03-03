import { Entity, Column, PrimaryGeneratedColumn, Index, UpdateDateColumn, CreateDateColumn } from 'typeorm';
import { ServiceType } from '../orders/order.entity';

@Entity('services')
export class DeliveryService {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Index({ unique: true })
    @Column({
        type: 'enum',
        enum: ServiceType,
    })
    type: ServiceType;

    @Column({ type: 'boolean', default: true })
    isActive: boolean;

    @Column({ type: 'int', default: 0 })
    baseFareCents: number;

    @Column({ type: 'int', default: 0 })
    perKmCents: number;

    @Column({ type: 'json', nullable: true })
    courierRules: {
        perKgCents?: number;
        minWeightKg?: number;
        maxWeightKg?: number;
    } | null;

    @Column({ type: 'json', nullable: true })
    localServiceRules: {
        perM3Cents?: number;
        vehicleTypeMultipliers?: Record<string, number>;
        minVolumeM3?: number;
        maxVolumeM3?: number;
    } | null;

    @Column({ type: 'json', nullable: true })
    capacityRules: {
        maxWeightKg?: number;
        maxVolumeM3?: number;
    } | null;

    @Column({ type: 'json', nullable: true })
    etaModel: {
        baseMinutes?: number;
        minutesPerKm?: number;
    } | null;

    @Column({ type: 'varchar', length: 8, default: 'USD' })
    currency: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
