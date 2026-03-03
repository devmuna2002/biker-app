import { Controller, Post, Req, Headers, Res, BadRequestException, Logger } from '@nestjs/common';
import { Response } from 'express';
import { PaymentsService } from './payments.service';
import { StripePaypalService } from './stripe-paypal.service';
import { Public } from '../common/public.decorator';

@Controller('api/webhooks')
export class WebhooksController {
    private readonly logger = new Logger(WebhooksController.name);

    constructor(
        private readonly payments: PaymentsService,
        private readonly paymentGateway: StripePaypalService,
    ) { }

    @Public()
    @Post('stripe')
    async handleStripe(@Req() req: any, @Headers('stripe-signature') sig: string, @Res() res: Response) {
        if (!sig) throw new BadRequestException('Missing stripe-signature');

        try {
            // NOTE: In production, Stripe requires the RAW body to verify.
            // Ensure NestJS is configured to provide the raw body if needed.
            const result = await this.paymentGateway.handleStripeWebhook(req.body, sig);

            if (result.type === 'payment_intent.succeeded') {
                const intent = result.data.object;
                const { bikerId, subscriptionType, userId } = intent.metadata;

                // Finalize sub activation
                await this.payments.createSubscription(bikerId || userId, {
                    subscriptionType: subscriptionType as any,
                    amount: intent.amount,
                    currency: intent.currency,
                    startDate: new Date(),
                    subscriptionStatus: 'active' as any,
                    paymentProvider: 'stripe',
                    providerSubscriptionId: intent.id,
                });
            }

            return res.status(200).send({ received: true });
        } catch (e) {
            this.logger.error('Stripe webhook error: ' + e.message);
            return res.status(400).send(`Webhook error: ${e.message}`);
        }
    }

    @Public()
    @Post('paypal')
    async handlePayPal(@Req() req: any, @Res() res: Response) {
        const event = req.body;
        this.logger.log(`PayPal Webhook received: ${event.event_type}`);

        try {
            if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
                const resource = event.resource;
                const orderId = resource.supplementary_data?.related_ids?.order_id || resource.id;

                // Finalize sub activation
                // This logic would look up the pending sub by orderId or use metadata
                // Since our current model relies on the frontend 'capture' call,
                // we'll keep this as a secondary confirmation.
            }

            return res.status(200).send({ received: true });
        } catch (e) {
            this.logger.error('PayPal webhook error: ' + e.message);
            return res.status(400).send(`Webhook error: ${e.message}`);
        }
    }
}
