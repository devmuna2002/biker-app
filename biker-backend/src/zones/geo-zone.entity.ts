import { Entity, Column, PrimaryGeneratedColumn, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ServiceType } from '../orders/order.entity';

@Entity('geo_zones')
export class GeoZone {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Index({ unique: true })
    @Column({ type: 'varchar', length: 64 })
    code: string;

    @Column({ type: 'varchar', length: 128 })
    name: string;

    // Simple bounding box. For production, move to polygon + PostGIS.
    @Column({ type: 'float' })
    minLat: number;

    @Column({ type: 'float' })
    maxLat: number;

    @Column({ type: 'float' })
    minLng: number;

    @Column({ type: 'float' })
    maxLng: number;

    @Column({
        type: 'enum',
        enum: ServiceType,
        array: true,
        default: [ServiceType.BIKE, ServiceType.COURIER, ServiceType.LOCAL_SERVICES],
    })
    enabledServices: ServiceType[];

    @Column({ type: 'boolean', default: true })
    isActive: boolean;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
