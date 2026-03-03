import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn, Index, UpdateDateColumn } from 'typeorm';
import { Biker } from '../bikers/biker.entity';

@Entity('biker_locations')
export class BikerLocation {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Index()
    @ManyToOne(() => Biker, { nullable: false, onDelete: 'CASCADE' })
    biker: Biker;

    @Column({ type: 'float' })
    latitude: number;

    @Column({ type: 'float' })
    longitude: number;

    @Index({ spatial: true })
    @Column({
        type: 'geometry',
        spatialFeatureType: 'Point',
        srid: 4326,
        nullable: true,
    })
    location: any;

    @Column({ type: 'float', nullable: true })
    heading: number; // Direction in degrees (0-360)

    @Column({ type: 'float', nullable: true })
    speed: number; // Speed in m/s

    @Column({ type: 'float', nullable: true })
    accuracy: number; // Accuracy in meters

    @UpdateDateColumn()
    updatedAt: Date;
}
