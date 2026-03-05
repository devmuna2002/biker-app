import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn } from 'typeorm';
import { Order } from './order.entity';
import { Biker } from '../bikers/biker.entity';

@Entity('order_bids')
export class OrderBid {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Order)
    order: Order;

    @ManyToOne(() => Biker)
    biker: Biker;

    @Column({ type: 'int' })
    offeredPriceCents: number;

    @Column({ type: 'int', nullable: true })
    etaMinutes: number;

    @Column({ type: 'float', nullable: true })
    distanceKm: number;

    @CreateDateColumn()
    createdAt: Date;

    @Column({ default: 'pending' })
    status: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
}
