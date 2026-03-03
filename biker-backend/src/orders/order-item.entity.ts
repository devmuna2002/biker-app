import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn, Index } from 'typeorm';
import { Order } from './order.entity';

@Entity('order_items')
export class OrderItem {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Index()
    @ManyToOne(() => Order)
    order: Order;

    @Column({ type: 'varchar', length: 256 })
    name: string;

    @Column({ type: 'int', default: 1 })
    quantity: number;

    @Column({ type: 'float', nullable: true })
    weightKg: number | null;

    @Column({ type: 'float', nullable: true })
    volumeM3: number | null;

    @CreateDateColumn()
    createdAt: Date;
}
