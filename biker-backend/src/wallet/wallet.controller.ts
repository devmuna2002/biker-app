import { Controller, Post, Get, Body, Param, UseGuards, Request } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WalletUserType } from './wallet.entity';

@Controller('api/wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
    constructor(private readonly walletService: WalletService) {}

    @Get('balance')
    async getBalance(@Request() req) {
        const userId = req.user.userId;
        const userType = req.user.role === 'rider' ? WalletUserType.RIDER : WalletUserType.CUSTOMER;
        
        const balance = await this.walletService.getWalletBalance(userId, userType);
        return { balance };
    }

    @Get('transactions')
    async getTransactions(@Request() req) {
        const userId = req.user.userId;
        const userType = req.user.role === 'rider' ? WalletUserType.RIDER : WalletUserType.CUSTOMER;
        
        return this.walletService.getWalletTransactions(userId, userType);
    }

    @Post('withdraw')
    async withdraw(
        @Request() req,
        @Body() body: { amount: number; payment_method: string; payment_details: any }
    ) {
        const userId = req.user.userId;
        const userType = req.user.role === 'rider' ? WalletUserType.RIDER : WalletUserType.CUSTOMER;

        const result = await this.walletService.requestWithdrawal(
            userId,
            userType,
            body.amount,
            body.payment_method,
            body.payment_details
        );

        return { message: 'Withdrawal request submitted', withdrawal_id: result.withdrawal_id };
    }

    @Post('deposit')
    async deposit(
        @Request() req,
        @Body() body: { amount: number }
    ) {
        const userId = req.user.userId;
        const userType = req.user.role === 'rider' ? WalletUserType.RIDER : WalletUserType.CUSTOMER;

        const result = await this.walletService.creditWallet(
            userId,
            userType,
            body.amount,
            'deposit' as any,
            'Wallet deposit'
        );

        return { message: 'Deposit successful', transaction_id: result.transaction_id };
    }
}
