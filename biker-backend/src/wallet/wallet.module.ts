import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { Wallet, WalletTransaction, Withdrawal } from './wallet.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([Wallet, WalletTransaction, Withdrawal]),
    ],
    controllers: [WalletController],
    providers: [WalletService],
    exports: [WalletService],
})
export class WalletModule {}
