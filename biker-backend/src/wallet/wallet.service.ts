import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Wallet, WalletTransaction, Withdrawal, TransactionType, TransactionStatus } from './wallet.entity';
import { WalletUserType } from './wallet.entity';

@Injectable()
export class WalletService {
    private readonly logger = new Logger(WalletService.name);

    constructor(
        @InjectRepository(Wallet)
        private walletRepository: Repository<Wallet>,
        @InjectRepository(WalletTransaction)
        private transactionRepository: Repository<WalletTransaction>,
        @InjectRepository(Withdrawal)
        private withdrawalRepository: Repository<Withdrawal>,
        private dataSource: DataSource,
    ) {}

    async getOrCreateWallet(user_id: string, user_type: WalletUserType): Promise<Wallet> {
        let wallet = await this.walletRepository.findOne({
            where: { user_id, user_type },
        });

        if (!wallet) {
            wallet = this.walletRepository.create({
                user_id,
                user_type,
                balance: 0,
            });
            wallet = await this.walletRepository.save(wallet);
        }

        return wallet;
    }

    async getWalletBalance(user_id: string, user_type: WalletUserType): Promise<number> {
        const wallet = await this.getOrCreateWallet(user_id, user_type);
        return Number(wallet.balance);
    }

    async creditWallet(
        user_id: string,
        user_type: WalletUserType,
        amount: number,
        type: TransactionType,
        description?: string,
        trip_id?: string
    ): Promise<WalletTransaction> {
        const wallet = await this.getOrCreateWallet(user_id, user_type);
        
        const balance_before = Number(wallet.balance);
        const balance_after = balance_before + amount;

        // Update wallet
        if (type === TransactionType.TRIP_EARNING || type === TransactionType.DEPOSIT) {
            wallet.balance = balance_after;
            wallet.total_earned = Number(wallet.total_earned) + amount;
        } else {
            wallet.balance = balance_after;
        }
        
        await this.walletRepository.save(wallet);

        // Record transaction
        const transaction = this.transactionRepository.create({
            wallet_id: wallet.wallet_id,
            trip_id,
            type,
            amount,
            balance_before,
            balance_after,
            description,
            status: TransactionStatus.COMPLETED,
        });

        return this.transactionRepository.save(transaction);
    }

    async debitWallet(
        user_id: string,
        user_type: WalletUserType,
        amount: number,
        type: TransactionType,
        description?: string
    ): Promise<WalletTransaction> {
        const wallet = await this.getOrCreateWallet(user_id, user_type);

        if (Number(wallet.balance) < amount) {
            throw new Error('Insufficient balance');
        }

        const balance_before = Number(wallet.balance);
        const balance_after = balance_before - amount;

        // Update wallet
        wallet.balance = balance_after;
        if (type === TransactionType.WITHDRAW || type === TransactionType.TRIP_PAYMENT) {
            wallet.total_spent = Number(wallet.total_spent) + amount;
        }
        
        await this.walletRepository.save(wallet);

        // Record transaction
        const transaction = this.transactionRepository.create({
            wallet_id: wallet.wallet_id,
            type,
            amount,
            balance_before,
            balance_after,
            description,
            status: TransactionStatus.COMPLETED,
        });

        return this.transactionRepository.save(transaction);
    }

    async processTripCompletion(
        trip_id: string,
        rider_id: string,
        final_price: number
    ): Promise<{ rider_amount: number; commission: number }> {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const commission_rate = 0.15;
            const commission = Number((final_price * commission_rate).toFixed(2));
            const rider_amount = Number((final_price - commission).toFixed(2));

            // Credit rider wallet
            await this.creditWallet(
                rider_id,
                WalletUserType.RIDER,
                rider_amount,
                TransactionType.TRIP_EARNING,
                `Trip earnings for trip ${trip_id}`,
                trip_id
            );

            // Credit admin wallet (assuming admin user_id = 'admin-system')
            await this.creditWallet(
                'admin-system',
                WalletUserType.ADMIN,
                commission,
                TransactionType.COMMISSION,
                `Commission from trip ${trip_id}`,
                trip_id
            );

            await queryRunner.commitTransaction();

            return { rider_amount, commission };
        } catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    async requestWithdrawal(
        user_id: string,
        user_type: WalletUserType,
        amount: number,
        payment_method: string,
        payment_details: any
    ): Promise<Withdrawal> {
        const wallet = await this.getOrCreateWallet(user_id, user_type);

        if (Number(wallet.balance) < amount) {
            throw new Error('Insufficient balance');
        }

        // Deduct from balance
        wallet.balance = Number(wallet.balance) - amount;
        await this.walletRepository.save(wallet);

        // Create withdrawal request
        const withdrawal = this.withdrawalRepository.create({
            wallet_id: wallet.wallet_id,
            amount,
            payment_method,
            payment_details,
            status: 'pending',
        });

        return this.withdrawalRepository.save(withdrawal);
    }

    async getWalletTransactions(user_id: string, user_type: WalletUserType): Promise<WalletTransaction[]> {
        const wallet = await this.walletRepository.findOne({
            where: { user_id, user_type },
        });

        if (!wallet) return [];

        return this.transactionRepository.find({
            where: { wallet_id: wallet.wallet_id },
            order: { created_at: 'DESC' },
        });
    }

    async getAdminEarnings(): Promise<number> {
        const adminWallet = await this.walletRepository.findOne({
            where: { user_type: WalletUserType.ADMIN },
        });
        
        return adminWallet ? Number(adminWallet.balance) : 0;
    }
}
