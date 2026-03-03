import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn, Index, UpdateDateColumn } from 'typeorm';
import { Order } from '../orders/order.entity';
import { User } from '../users/user.entity';
import { Biker } from '../bikers/biker.entity';

export enum PaymentStatus {
    PENDING = 'pending',
    SUCCESS = 'success',
    FAILED = 'failed',
}

export enum PaymentType {
    SUBSCRIPTION = 'subscription',
    FEE_PAYMENT = 'fee_payment',
    RIDE_PAYMENT = 'ride_payment',
}

export enum PaymentMethod {
    CASH = 'cash',
    MOBILE_MONEY = 'mobile_money',
    WALLET = 'wallet',
    CARD = 'card',
}

@Entity('payments')
export class Payment {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Index()
    @ManyToOne(() => Order, { nullable: true })
    ride: Order | null; // optional, ride-related payment

    @Index()
    @ManyToOne(() => User, { nullable: true })
    customer: User | null; // could be null for subscription/fee

    @Index()
    @ManyToOne(() => Biker, { nullable: true })
    biker: Biker | null; // for fees or subscription payments

    @Column({ type: 'int' })
    amount: number; // in cents

    @Column({ type: 'varchar', length: 8, default: 'USD' })
    currency: string;

    @Column({
        type: 'varchar',
        length: 50,
    })
    paymentType: PaymentType;

    @Column({ type: 'varchar', length: 50 })
    provider: string; // stripe, paypal, mobile_money, cash

    @Column({ type: 'varchar', length: 255, nullable: true })
    providerPaymentId: string | null;

    @Column({
        type: 'enum',
        enum: PaymentStatus,
        default: PaymentStatus.PENDING,
    })
    status: PaymentStatus;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
