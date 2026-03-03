import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn, Index } from 'typeorm';
import { Biker, DriverVehicleType } from '../bikers/biker.entity';

@Entity('vehicles')
export class Vehicle {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Index()
    @ManyToOne(() => Biker)
    biker: Biker;

    @Column({
        type: 'enum',
        enum: DriverVehicleType,
    })
    type: DriverVehicleType;

    @Column({ type: 'varchar', length: 64, nullable: true })
    plateNumber: string | null;

    @Column({ type: 'varchar', length: 128, nullable: true })
    model: string | null;

    @Column({ type: 'int', default: 0 })
    capacityWeightKg: number;

    @Column({ type: 'float', default: 0 })
    capacityVolumeM3: number;

    @CreateDateColumn()
    createdAt: Date;
}
