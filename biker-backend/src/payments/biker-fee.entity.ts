import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { Biker } from '../bikers/biker.entity';
import { Order } from '../orders/order.entity';

export enum FeeStatus {
    PENDING = 'pending',
    PAID = 'paid',
    DISPUTED = 'disputed',
}

@Entity('biker_fees')
export class BikerFee {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Index()
    @ManyToOne(() => Biker, { nullable: false })
    biker: Biker;

    @Index()
    @ManyToOne(() => Order, { nullable: false })
    ride: Order; // referring to 'rides' in frontend terminology, 'orders' in backend

    @Column({ type: 'int' })
    feeAmount: number; // in cents

    @Column({ type: 'varchar', length: 8, default: 'USD' })
    currency: string;

    @Column({
        type: 'varchar',
        length: 50,
        default: FeeStatus.PENDING,
    })
    feeStatus: FeeStatus;

    @Column({ type: 'date', nullable: true })
    dueDate: Date;

    @Column({ type: 'timestamp', nullable: true })
    paidAt: Date;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
