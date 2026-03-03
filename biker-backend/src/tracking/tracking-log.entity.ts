import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn, Index } from 'typeorm';
import { TrackingSession } from './tracking-session.entity';
import { Biker } from '../bikers/biker.entity';

@Entity('tracking_logs')
export class TrackingLog {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Index()
    @ManyToOne(() => TrackingSession)
    session: TrackingSession;

    @Index()
    @ManyToOne(() => Biker, { nullable: true })
    biker: Biker | null;

    @Column({ type: 'float' })
    lat: number;

    @Column({ type: 'float' })
    lng: number;

    @Column({ type: 'float', nullable: true })
    speedMps: number | null;

    @Column({ type: 'float', nullable: true })
    headingDeg: number | null;

    @Column({ type: 'float', nullable: true })
    accuracyM: number | null;

    @Column({ type: 'timestamp' })
    recordedAt: Date;

    @Column({ type: 'boolean', default: false })
    isSuspectedSpoof: boolean;

    @CreateDateColumn()
    createdAt: Date;
}
