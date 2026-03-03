import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { Biker } from '../bikers/biker.entity';

export enum SubscriptionType {
    WEEKLY = 'weekly',
    MONTHLY = 'monthly',
}

export enum SubscriptionStatus {
    ACTIVE = 'active',
    EXPIRED = 'expired',
    CANCELLED = 'cancelled',
}

@Entity('biker_subscriptions')
export class BikerSubscription {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Index()
    @ManyToOne(() => Biker, { nullable: false })
    biker: Biker;

    @Column({
        type: 'varchar',
        length: 50,
        enum: SubscriptionType,
    })
    subscriptionType: SubscriptionType;

    @Column({ type: 'int' })
    amount: number; // in cents

    @Column({ type: 'varchar', length: 8, default: 'USD' })
    currency: string;

    @Column({ type: 'date' })
    startDate: Date;

    @Column({ type: 'date' })
    expiryDate: Date;

    @Column({ type: 'varchar', length: 50, nullable: true })
    paymentProvider: string; // stripe, paypal, mobile_money

    @Column({ type: 'varchar', length: 255, nullable: true })
    providerSubscriptionId: string; // For managing recurring payments

    @Column({
        type: 'varchar',
        length: 50,
        default: SubscriptionStatus.ACTIVE,
        enum: SubscriptionStatus,
    })
    subscriptionStatus: SubscriptionStatus;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
