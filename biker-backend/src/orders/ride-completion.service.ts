import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus } from '../orders/order.entity';
import { BikerFee, FeeStatus } from '../payments/biker-fee.entity';
import { Payment, PaymentStatus, PaymentType } from '../payments/payment.entity';
import { Biker } from '../bikers/biker.entity';

@Injectable()
export class RideCompletionService {
    private readonly logger = new Logger(RideCompletionService.name);

    constructor(
        @InjectRepository(Order)
        private orderRepository: Repository<Order>,
        @InjectRepository(BikerFee)
        private bikerFeeRepository: Repository<BikerFee>,
        @InjectRepository(Payment)
        private paymentRepository: Repository<Payment>,
        @InjectRepository(Biker)
        private bikerRepository: Repository<Biker>,
    ) {}

    /**
     * Complete a ride and calculate fees
     * 
     * System:
     * - Ride completed with Fare = $5
     * - Platform fee = $0.50 (10% or fixed, depending on config)
     * - Biker receives: $5 - $0.50 = $4.50
     * 
     * Database updated:
     * - rides table: ride_status = 'completed', updated_at = now
     * - biker_fees table: new fee entry with $4.50 (pending)
     * - payments table: new payment entry for customer's fare
     */
    async completeRide(
        rideId: number,
        finalFareCents: number,
        platformFeeCents: number = Math.round(finalFareCents * 0.1), // 10% default
    ): Promise<{
        ride: Order;
        bikerFee: BikerFee;
        payment: Payment;
    }> {
        try {
            // Get the ride
            const ride = await this.orderRepository.findOne({
                where: { id: rideId },
                relations: ['user', 'biker'],
            });

            if (!ride) {
                throw new BadRequestException(`Ride ${rideId} not found`);
            }

            if (ride.finalPriceCents !== finalFareCents) {
                this.logger.warn(
                    `Ride ${rideId} final price mismatch: ${ride.finalPriceCents} vs ${finalFareCents}`,
                );
            }

            // Calculate biker earnings
            const bikerEarningsCents = finalFareCents - platformFeeCents;

            // Update ride status
            ride.finalPriceCents = finalFareCents;
            ride.status = OrderStatus.COMPLETED;
            ride.paymentStatus = 'completed';
            const updatedRide = await this.orderRepository.save(ride);

            // Create biker fee record (what biker earned from this ride)
            const bikerFee = await this.bikerFeeRepository.save(
                this.bikerFeeRepository.create({
                    biker: ride.biker,
                    ride: ride,
                    feeAmount: bikerEarningsCents,
                    currency: 'USD',
                    feeStatus: FeeStatus.PENDING,
                    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Due in 7 days
                }),
            );

            // Create payment record (customer payment)
            const payment = await this.paymentRepository.save(
                this.paymentRepository.create({
                    customer: ride.user,
                    biker: ride.biker,
                    ride: ride,
                    amount: finalFareCents,
                    currency: 'USD',
                    paymentType: PaymentType.RIDE_PAYMENT,
                    provider: 'cash',
                    status: PaymentStatus.SUCCESS,
                }) as any,
            );

            this.logger.log(
                `Completed ride ${rideId}: Fare=$${finalFareCents / 100}, Fee=$${platformFeeCents / 100}, Biker=$${bikerEarningsCents / 100}`,
            );

            return { ride: updatedRide, bikerFee, payment };
        } catch (error) {
            this.logger.error(`Failed to complete ride: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get pending fees for a biker
     */
    async getBikerPendingFees(bikerId: string): Promise<{
        totalPendingCents: number;
        feeCount: number;
        fees: BikerFee[];
    }> {
        const fees = await this.bikerFeeRepository.find({
            where: {
                biker: { id: bikerId as any },
                feeStatus: FeeStatus.PENDING,
            },
            relations: ['ride'],
            order: { createdAt: 'DESC' },
        });

        const totalPendingCents = fees.reduce((sum, fee) => sum + fee.feeAmount, 0);

        return {
            totalPendingCents,
            feeCount: fees.length,
            fees,
        };
    }

    /**
     * Mark biker fees as paid (usually after payment processor confirmation)
     */
    async markFeeAsPaid(feeId: string): Promise<BikerFee> {
        const fee = await this.bikerFeeRepository.findOne({
            where: { id: feeId },
        });

        if (!fee) {
            throw new BadRequestException(`Fee ${feeId} not found`);
        }

        fee.feeStatus = FeeStatus.PAID;
        fee.paidAt = new Date();

        return await this.bikerFeeRepository.save(fee);
    }

    /**
     * Get ride details and associated fees
     */
    async getRideDetails(rideId: number): Promise<{
        ride: Order;
        bikerFee: BikerFee | null;
        payment: Payment | null;
    }> {
        const ride = await this.orderRepository.findOne({
            where: { id: rideId },
            relations: ['user', 'biker'],
        });

        if (!ride) {
            throw new BadRequestException(`Ride ${rideId} not found`);
        }

        const bikerFee = await this.bikerFeeRepository.findOne({
            where: { ride: { id: rideId } },
        });

        const payment = await this.paymentRepository.findOne({
            where: { ride: { id: rideId } },
        });

        return { ride, bikerFee, payment };
    }
}
