import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus, PaymentType } from './payment.entity';
import { BikerFee, FeeStatus } from './biker-fee.entity';
import { BikerSubscription, SubscriptionStatus } from './biker-subscription.entity';
import { Biker } from '../bikers/biker.entity';
import { Order } from '../orders/order.entity';
import { User } from '../users/user.entity';

@Injectable()
export class PaymentsService {
    private readonly logger = new Logger(PaymentsService.name);

    constructor(
        @InjectRepository(Payment)
        private paymentRepo: Repository<Payment>,
        @InjectRepository(BikerFee)
        private feeRepo: Repository<BikerFee>,
        @InjectRepository(BikerSubscription)
        private subRepo: Repository<BikerSubscription>,
        @InjectRepository(Biker)
        private bikerRepo: Repository<Biker>,
        @InjectRepository(Order)
        private orderRepo: Repository<Order>,
        @InjectRepository(User)
        private userRepo: Repository<User>,
    ) { }

    async recordPayment(data: Partial<Payment>): Promise<Payment> {
        const payment = this.paymentRepo.create(data);
        return await this.paymentRepo.save(payment);
    }

    async getBikerFees(userOrBikerId: string) {
        // Support lookup by either userId or biker entity id
        const biker = await this.bikerRepo.findOne({
            where: { user: { id: Number(userOrBikerId) } } as any,
        });
        const bikerId = biker?.id ?? Number(userOrBikerId);
        return this.feeRepo.find({
            where: { biker: { id: bikerId as any } },
            order: { createdAt: 'DESC' },
        });
    }

    async getBikerSubscriptions(userOrBikerId: string) {
        const biker = await this.bikerRepo.findOne({
            where: { user: { id: Number(userOrBikerId) } } as any,
        });
        const bikerId = biker?.id ?? Number(userOrBikerId);
        return this.subRepo.find({
            where: { biker: { id: bikerId as any } },
            order: { startDate: 'DESC' },
        });
    }

    async createSubscription(userOrBikerId: string, payload: Partial<BikerSubscription>) {
        // Try to find biker by user.id first (most common case from frontend), then by biker.id
        let biker = await this.bikerRepo.findOne({ where: { user: { id: Number(userOrBikerId) } } as any, relations: ['user'] });
        if (!biker) {
            biker = await this.bikerRepo.findOne({ where: { id: userOrBikerId as any } });
        }
        if (!biker) throw new Error(`Biker not found for id=${userOrBikerId}`);
        const sub = this.subRepo.create({ biker, ...payload });
        const saved = await this.subRepo.save(sub);

        // update biker record to reflect latest subscription status/expiry
        if (biker) {
            if (payload.subscriptionStatus) biker.subscriptionStatus = payload.subscriptionStatus as string;
            if (payload.expiryDate) biker.subscriptionExpiryDate = new Date(payload.expiryDate);
            if (biker.isOnline && biker.subscriptionStatus === 'active') {
                biker.isAvailable = true;
            }
            await this.bikerRepo.save(biker);
        }

        return saved;
    }

    async markSubscriptionPaid(subId: string) {
        const sub = await this.subRepo.findOne({ where: { id: subId }, relations: ['biker'] });
        if (!sub) throw new Error(`Subscription ${subId} not found`);
        sub.subscriptionStatus = SubscriptionStatus.ACTIVE;
        const saved = await this.subRepo.save(sub);

        // sync biker table fields as well
        if (sub.biker) {
            sub.biker.subscriptionStatus = SubscriptionStatus.ACTIVE;
            if (sub.expiryDate) sub.biker.subscriptionExpiryDate = sub.expiryDate;
            if (sub.biker.isOnline) {
                sub.biker.isAvailable = true;
            }
            await this.bikerRepo.save(sub.biker);
        }

        return saved;
    }

    async markFeePaid(feeId: string) {
        const fee = await this.feeRepo.findOne({ where: { id: feeId } });
        if (!fee) throw new Error(`Fee ${feeId} not found`);
        fee.feeStatus = FeeStatus.PAID;
        fee.paidAt = new Date();
        return this.feeRepo.save(fee);
    }


    // expire subscriptions whose expiryDate has passed
    async expireDueSubscriptions(): Promise<number> {
        const now = new Date();
        const expired = await this.subRepo.createQueryBuilder()
            .update(BikerSubscription)
            .set({ subscriptionStatus: SubscriptionStatus.EXPIRED })
            .where('expiryDate < :now', { now })
            .andWhere('subscriptionStatus = :active', { active: SubscriptionStatus.ACTIVE })
            .execute();

        // also update biker records
        await this.bikerRepo.createQueryBuilder()
            .update()
            .set({ subscriptionStatus: SubscriptionStatus.EXPIRED, subscriptionExpiryDate: null })
            .where('subscriptionExpiryDate < :now', { now })
            .andWhere('subscriptionStatus = :active', { active: SubscriptionStatus.ACTIVE })
            .execute();

        return expired.affected || 0;
    }

    /**
     * A simple list of the plans clients can purchase.  In a real system
     * this might live in its own table or be configurable by an admin.
     */
    getPlans() {
        return [
            { subscriptionType: 'weekly', amount: 500, currency: 'USD', label: 'Weekly', durationDays: 7 },
            { subscriptionType: 'monthly', amount: 1500, currency: 'USD', label: 'Monthly', durationDays: 30 },
        ];
    }
}

