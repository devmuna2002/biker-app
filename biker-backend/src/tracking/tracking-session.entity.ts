import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn, Index, UpdateDateColumn } from 'typeorm';
import { Order } from '../orders/order.entity';

export enum TrackingSessionStatus {
    ACTIVE = 'active',
    ENDED = 'ended',
}

@Entity('tracking_sessions')
export class TrackingSession {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Index({ unique: true })
    @ManyToOne(() => Order)
    order: Order;

    @Column({
        type: 'enum',
        enum: TrackingSessionStatus,
        default: TrackingSessionStatus.ACTIVE,
    })
    status: TrackingSessionStatus;

    @Column({ type: 'timestamp', nullable: true })
    startedAt: Date | null;

    @Column({ type: 'timestamp', nullable: true })
    endedAt: Date | null;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
