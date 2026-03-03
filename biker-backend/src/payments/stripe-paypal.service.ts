import { Injectable, BadRequestException, Logger } from '@nestjs/common';

/**
 * StripePaypalService
 * -------------------
 * Handles real-money payment intents via Stripe and PayPal.
 *
 * PRODUCTION SETUP:
 *   1. npm install stripe @paypal/paypal-js (backend: stripe paypal-rest-sdk)
 *   2. Set env vars:
 *        STRIPE_SECRET_KEY=sk_live_...
 *        PAYPAL_CLIENT_ID=...
 *        PAYPAL_CLIENT_SECRET=...
 *        PAYPAL_MODE=live   (or sandbox)
 *
 * Currently the Stripe SDK is called if STRIPE_SECRET_KEY is set,
 * otherwise it simulates the intent (for development/demo).
 */
@Injectable()
export class StripePaypalService {
    private readonly logger = new Logger(StripePaypalService.name);
    private stripe: any = null;

    constructor() {
        const key = process.env.STRIPE_SECRET_KEY;
        if (key) {
            try {
                // Dynamically require Stripe only when the key exists
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const Stripe = require('stripe');
                this.stripe = new Stripe(key, { apiVersion: '2023-10-16' });
                this.logger.log('Stripe initialised with live key');
            } catch (e) {
                this.logger.warn('stripe package not installed – Stripe payments will be simulated: ' + e.message);
            }
        } else {
            this.logger.warn('STRIPE_SECRET_KEY not set – Stripe payments will be simulated');
        }
    }

    // ── STRIPE ───────────────────────────────────────────────────────────────

    /**
     * Create a PaymentIntent on Stripe.
     * Returns { clientSecret, paymentIntentId } to be confirmed on the client.
     */
    async createStripePaymentIntent(amountCents: number, currency: string, metadata: Record<string, string> = {}) {
        if (!amountCents || amountCents < 50) throw new BadRequestException('Amount must be at least 50 cents');
        const cur = (currency || 'usd').toLowerCase();

        if (this.stripe) {
            try {
                const intent = await this.stripe.paymentIntents.create({
                    amount: amountCents,
                    currency: cur,
                    metadata,
                    automatic_payment_methods: { enabled: true },
                });
                return {
                    clientSecret: intent.client_secret,
                    paymentIntentId: intent.id,
                    provider: 'stripe',
                    simulated: false,
                };
            } catch (e) {
                this.logger.error('Stripe createPaymentIntent failed', e.message);
                throw new BadRequestException(`Stripe error: ${e.message}`);
            }
        }

        // --- Simulated response (dev/demo) ---
        if (process.env.ALLOW_SIMULATED_PAYMENTS === 'true') {
            const simulatedId = `pi_sim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            return {
                clientSecret: `${simulatedId}_secret_demo`,
                paymentIntentId: simulatedId,
                provider: 'stripe',
                simulated: true,
            };
        }

        throw new BadRequestException('Real Stripe configuration is missing or invalid, and simulation is disabled on this server.');
    }

    /**
     * Confirm a Stripe PaymentIntent (server-side confirm after client-side 3DS).
     */
    async confirmStripePaymentIntent(paymentIntentId: string) {
        if (!paymentIntentId) throw new BadRequestException('paymentIntentId required');

        if (paymentIntentId.startsWith('pi_sim_')) {
            if (process.env.ALLOW_SIMULATED_PAYMENTS === 'true') {
                this.logger.log('Confirming simulated Stripe payment (demo mode)');
                return { status: 'succeeded', provider: 'stripe', simulated: true };
            }
            throw new BadRequestException('Simulated payments are disabled on this server. Real payment required.');
        }

        if (this.stripe) {
            try {
                const intent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
                return { status: intent.status, provider: 'stripe', simulated: false };
            } catch (e) {
                throw new BadRequestException(`Stripe error: ${e.message}`);
            }
        }

        throw new BadRequestException('Stripe not configured and simulation is disabled.');
    }

    // ── PAYPAL ────────────────────────────────────────────────────────────────

    private async getPayPalAccessToken(): Promise<string> {
        const clientId = process.env.PAYPAL_CLIENT_ID;
        const secret = process.env.PAYPAL_CLIENT_SECRET;
        const mode = process.env.PAYPAL_MODE === 'live' ? 'live' : 'sandbox';
        const base = mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

        if (!clientId || !secret) throw new BadRequestException('PayPal not configured (missing env vars)');

        const creds = Buffer.from(`${clientId}:${secret}`).toString('base64');
        const res = await fetch(`${base}/v1/oauth2/token`, {
            method: 'POST',
            headers: {
                Authorization: `Basic ${creds}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: 'grant_type=client_credentials',
        });
        const data = await res.json() as any;
        if (!data.access_token) throw new BadRequestException('Failed to get PayPal access token');
        return data.access_token;
    }

    /**
     * Create a PayPal order (captures real money).
     * Returns { orderId, approveUrl } – approveUrl is where the user approves the payment.
     */
    async createPayPalOrder(amountCents: number, currency: string, description: string) {
        if (!amountCents || amountCents < 50) throw new BadRequestException('Amount must be at least 50 cents');

        const clientId = process.env.PAYPAL_CLIENT_ID;
        const mode = process.env.PAYPAL_MODE === 'live' ? 'live' : 'sandbox';
        const base = mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

        if (!clientId) {
            if (process.env.ALLOW_SIMULATED_PAYMENTS === 'true') {
                // Simulated
                const simId = `PAYPAL_SIM_${Date.now()}`;
                return {
                    orderId: simId,
                    approveUrl: `https://www.sandbox.paypal.com/checkoutnow?token=${simId}`,
                    provider: 'paypal',
                    simulated: true,
                };
            }
            throw new BadRequestException('Real PayPal configuration is missing, and simulation is disabled.');
        }

        try {
            const token = await this.getPayPalAccessToken();
            const amountStr = (amountCents / 100).toFixed(2);
            const cur = (currency || 'USD').toUpperCase();

            const res = await fetch(`${base}/v2/checkout/orders`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    intent: 'CAPTURE',
                    purchase_units: [{
                        amount: { currency_code: cur, value: amountStr },
                        description,
                    }],
                }),
            });
            const data = await res.json() as any;
            if (!data.id) throw new Error(data.message || 'PayPal order creation failed');
            const approveUrl = data.links?.find((l: any) => l.rel === 'approve')?.href || '';
            return { orderId: data.id, approveUrl, provider: 'paypal', simulated: false };
        } catch (e) {
            this.logger.error('PayPal createOrder failed', e.message);
            throw new BadRequestException(`PayPal error: ${e.message}`);
        }
    }

    /**
     * Capture a PayPal order after user approves.
     */
    async capturePayPalOrder(orderId: string) {
        if (!orderId) throw new BadRequestException('orderId required');

        if (orderId.startsWith('PAYPAL_SIM_')) {
            if (process.env.ALLOW_SIMULATED_PAYMENTS === 'true') {
                this.logger.log('Capturing simulated PayPal order (demo mode)');
                return { status: 'COMPLETED', provider: 'paypal', simulated: true };
            }
            throw new BadRequestException('Simulated payments are disabled on this server. Real payment required.');
        }

        const clientId = process.env.PAYPAL_CLIENT_ID;
        const mode = process.env.PAYPAL_MODE === 'live' ? 'live' : 'sandbox';
        const base = mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

        if (!clientId) throw new BadRequestException('PayPal not configured');

        try {
            const token = await this.getPayPalAccessToken();
            const res = await fetch(`${base}/v2/checkout/orders/${orderId}/capture`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            });
            const data = await res.json() as any;
            return { status: data.status, provider: 'paypal', orderId, simulated: false };
        } catch (e) {
            throw new BadRequestException(`PayPal capture error: ${e.message}`);
        }
    }

    /**
     * Verify and construct a Stripe Webhook event.
     */
    async handleStripeWebhook(payload: any, signature: string) {
        if (!this.stripe) throw new BadRequestException('Stripe not configured');
        const secret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!secret) {
            this.logger.warn('STRIPE_WEBHOOK_SECRET not set – Webhook verification skipped (insecure!)');
            // In dev without secret, we might just return the payload as is if it looks like an event
            return typeof payload === 'string' ? JSON.parse(payload) : payload;
        }

        try {
            return this.stripe.webhooks.constructEvent(payload, signature, secret);
        } catch (err) {
            this.logger.error(`Webhook signature verification failed: ${err.message}`);
            throw new BadRequestException(`Webhook Error: ${err.message}`);
        }
    }
}
