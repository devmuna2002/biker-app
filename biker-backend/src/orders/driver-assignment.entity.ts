import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    ManyToOne,
    CreateDateColumn,
    Index,
} from 'typeorm';
import { Order } from './order.entity';
import { Biker } from '../bikers/biker.entity';

export enum DriverAssignmentStatus {
    LOCKED = 'locked',
    DISPATCHED = 'dispatched',
    ACCEPTED = 'accepted',
    DECLINED = 'declined',
    CANCELLED = 'cancelled',
}

@Entity('driver_assignments')
export class DriverAssignment {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Index()
    @ManyToOne(() => Order)
    order: Order;

    @Index()
    @ManyToOne(() => Biker)
    biker: Biker;

    @Column({
        type: 'enum',
        enum: DriverAssignmentStatus,
        default: DriverAssignmentStatus.LOCKED,
    })
    status: DriverAssignmentStatus;

    @Column({ type: 'timestamp' })
    lockedAt: Date;

    @Column({ type: 'timestamp', nullable: true })
    lockExpiresAt: Date | null;

    @Column({ type: 'timestamp', nullable: true })
    acceptedAt: Date | null;

    @CreateDateColumn()
    createdAt: Date;
}
