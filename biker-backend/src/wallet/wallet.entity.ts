import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum WalletUserType {
    CUSTOMER = 'customer',
    RIDER = 'rider',
    ADMIN = 'admin',
}

@Entity('wallets')
export class Wallet {
    @PrimaryGeneratedColumn('uuid')
    wallet_id: string;

    @Column({ name: 'user_id', type: 'uuid' })
    user_id: string;

    @Column({ name: 'user_type', type: 'varchar', length: 20 })
    user_type: WalletUserType;

    @Column({ type: 'decimal', precision: 12, scale: 2, default: 0.00 })
    balance: number;

    @Column({ name: 'pending_balance', type: 'decimal', precision: 12, scale: 2, default: 0.00 })
    pending_balance: number;

    @Column({ name: 'total_earned', type: 'decimal', precision: 12, scale: 2, default: 0.00 })
    total_earned: number;

    @Column({ name: 'total_spent', type: 'decimal', precision: 12, scale: 2, default: 0.00 })
    total_spent: number;

    @CreateDateColumn({ name: 'created_at' })
    created_at: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updated_at: Date;
}

export enum TransactionType {
    DEPOSIT = 'deposit',
    WITHDRAW = 'withdraw',
    TRIP_EARNING = 'trip_earning',
    TRIP_PAYMENT = 'trip_payment',
    COMMISSION = 'commission',
    REFUND = 'refund',
}

export enum TransactionStatus {
    PENDING = 'pending',
    COMPLETED = 'completed',
    FAILED = 'failed',
}

@Entity('wallet_transactions')
export class WalletTransaction {
    @PrimaryGeneratedColumn('uuid')
    transaction_id: string;

    @Column({ name: 'wallet_id', type: 'uuid' })
    wallet_id: string;

    @Column({ name: 'trip_id', type: 'uuid', nullable: true })
    trip_id: string;

    @Column({ type: 'varchar', length: 20 })
    type: TransactionType;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    amount: number;

    @Column({ name: 'balance_before', type: 'decimal', precision: 12, scale: 2 })
    balance_before: number;

    @Column({ name: 'balance_after', type: 'decimal', precision: 12, scale: 2 })
    balance_after: number;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ name: 'reference_id', type: 'varchar', length: 255, nullable: true })
    reference_id: string;

    @Column({ type: 'varchar', length: 20, default: TransactionStatus.COMPLETED })
    status: TransactionStatus;

    @CreateDateColumn({ name: 'created_at' })
    created_at: Date;
}

@Entity('withdrawals')
export class Withdrawal {
    @PrimaryGeneratedColumn('uuid')
    withdrawal_id: string;

    @Column({ name: 'wallet_id', type: 'uuid' })
    wallet_id: string;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    amount: number;

    @Column({ name: 'payment_method', type: 'varchar', length: 50 })
    payment_method: string;

    @Column({ name: 'payment_details', type: 'jsonb', nullable: true })
    payment_details: any;

    @Column({ type: 'varchar', length: 20, default: 'pending' })
    status: string;

    @Column({ name: 'processed_at', type: 'timestamp', nullable: true })
    processed_at: Date;

    @Column({ name: 'rejection_reason', type: 'text', nullable: true })
    rejection_reason: string;

    @CreateDateColumn({ name: 'created_at' })
    created_at: Date;
}
