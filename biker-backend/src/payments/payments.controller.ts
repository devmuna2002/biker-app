import { Controller, Post, Get, Body, Param, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { StripePaypalService } from './stripe-paypal.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { Public } from '../common/public.decorator';

@ApiTags('Payments & Fees')
@Controller('api/payments')
export class PaymentsController {
    constructor(
        private paymentsService: PaymentsService,
        private stripePaypal: StripePaypalService,
    ) { }

    // record a generic payment
    @Post()
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    async record(@Body() body: any) {
        return await this.paymentsService.recordPayment(body);
    }

    @Get('biker/:bikerId/fees')
    async bikerFees(@Param('bikerId') bikerId: string) {
        return this.paymentsService.getBikerFees(bikerId);
    }

    @Post('biker/:bikerId/fees/:feeId/paid')
    async payFee(@Param('feeId') feeId: string) {
        return this.paymentsService.markFeePaid(feeId);
    }

    @Get('biker/:bikerId/subscriptions')
    async bikerSubscriptions(@Param('bikerId') bikerId: string) {
        return this.paymentsService.getBikerSubscriptions(bikerId);
    }

    @Post('biker/:bikerId/subscriptions')
    async createSubscription(@Param('bikerId') bikerId: string, @Body() body: any) {
        return this.paymentsService.createSubscription(bikerId, body);
    }

    @Post('subscriptions/:subId/paid')
    async markSubscriptionPaid(@Param('subId') subId: string) {
        return this.paymentsService.markSubscriptionPaid(subId);
    }

    // return available subscription plans (configured on the server)
    @Public()
    @Get('plans')
    async plans() {
        return this.paymentsService.getPlans();
    }

    // ── STRIPE ENDPOINTS ─────────────────────────────────────────────────────

    /**
     * POST /api/payments/stripe/create-intent
     * Creates a Stripe PaymentIntent for subscription.
     * Body: { amountCents, currency, subscriptionType, bikerId }
     * Returns: { clientSecret, paymentIntentId }
     */
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @Post('stripe/create-intent')
    async stripeCreateIntent(
        @CurrentUser() user: any,
        @Body() body: { amountCents: number; currency?: string; subscriptionType: string; bikerId?: string },
    ) {
        const { amountCents, currency, subscriptionType, bikerId } = body;
        if (!amountCents || !subscriptionType) {
            throw new BadRequestException('amountCents and subscriptionType are required');
        }
        const result = await this.stripePaypal.createStripePaymentIntent(
            amountCents,
            currency || 'usd',
            {
                userId: String(user.id),
                bikerId: bikerId || String(user.id),
                subscriptionType,
            },
        );
        return { success: true, data: result };
    }

    /**
     * POST /api/payments/stripe/confirm
     * Confirms a Stripe PaymentIntent and activates subscription.
     * Body: { paymentIntentId, bikerId, subscriptionType, amountCents, currency, startDate, expiryDate }
     */
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @Post('stripe/confirm')
    async stripeConfirm(
        @CurrentUser() user: any,
        @Body() body: {
            paymentIntentId: string;
            bikerId: string;
            subscriptionType: string;
            amountCents: number;
            currency?: string;
            startDate?: string;
            expiryDate?: string;
            transactionId?: string;
        },
    ) {
        const { paymentIntentId, bikerId, subscriptionType, amountCents, currency, startDate, expiryDate } = body;
        const confirmation = await this.stripePaypal.confirmStripePaymentIntent(paymentIntentId);

        if (confirmation.status !== 'succeeded') {
            return { success: false, message: `Payment not confirmed. Status: ${confirmation.status}` };
        }

        // Activate subscription
        const sub = await this.paymentsService.createSubscription(bikerId || String(user.id), {
            subscriptionType: subscriptionType as any,
            amount: amountCents,
            currency: currency || 'USD',
            startDate: startDate ? new Date(startDate) : new Date(),
            expiryDate: expiryDate ? new Date(expiryDate) : undefined,
            subscriptionStatus: 'active' as any,
            paymentProvider: 'stripe',
            providerSubscriptionId: paymentIntentId,
        });

        return {
            success: true,
            data: {
                subscription: sub,
                payment: confirmation,
                message: 'Stripe payment confirmed and subscription activated.',
            },
        };
    }

    // ── PAYPAL ENDPOINTS ──────────────────────────────────────────────────────

    /**
     * POST /api/payments/paypal/create-order
     * Creates a PayPal order. Returns { orderId, approveUrl } for browser redirect.
     * Body: { amountCents, currency, subscriptionType }
     */
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @Post('paypal/create-order')
    async paypalCreateOrder(
        @CurrentUser() user: any,
        @Body() body: { amountCents: number; currency?: string; subscriptionType: string },
    ) {
        const { amountCents, currency, subscriptionType } = body;
        if (!amountCents || !subscriptionType) {
            throw new BadRequestException('amountCents and subscriptionType are required');
        }
        const result = await this.stripePaypal.createPayPalOrder(
            amountCents,
            currency || 'USD',
            `Biker App ${subscriptionType} subscription`,
        );
        return { success: true, data: result };
    }

    /**
     * POST /api/payments/paypal/capture
     * Captures a PayPal order after user approval and activates subscription.
     * Body: { orderId, bikerId, subscriptionType, amountCents, currency, expiryDate }
     */
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @Post('paypal/capture')
    async paypalCapture(
        @CurrentUser() user: any,
        @Body() body: {
            orderId: string;
            bikerId: string;
            subscriptionType: string;
            amountCents: number;
            currency?: string;
            startDate?: string;
            expiryDate?: string;
        },
    ) {
        const { orderId, bikerId, subscriptionType, amountCents, currency, startDate, expiryDate } = body;
        const capture = await this.stripePaypal.capturePayPalOrder(orderId);

        if (capture.status !== 'COMPLETED') {
            return { success: false, message: `PayPal payment not completed. Status: ${capture.status}` };
        }

        const sub = await this.paymentsService.createSubscription(bikerId || String(user.id), {
            subscriptionType: subscriptionType as any,
            amount: amountCents,
            currency: currency || 'USD',
            startDate: startDate ? new Date(startDate) : new Date(),
            expiryDate: expiryDate ? new Date(expiryDate) : undefined,
            subscriptionStatus: 'active' as any,
            paymentProvider: 'paypal',
            providerSubscriptionId: orderId,
        });

        return {
            success: true,
            data: {
                subscription: sub,
                payment: capture,
                message: 'PayPal payment confirmed and subscription activated.',
            },
        };
    }
}
