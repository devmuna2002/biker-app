import { Controller, Get, Post, Body, Param } from '@nestjs/common';

const FAQ_ITEMS = [
    { id: 1, q: 'How do I request a ride?', a: "Open the app, tap your desired service (Biker, Send a Package, or Local Services), enter your destination, and tap Confirm. We'll match you with a nearby driver instantly." },
    { id: 2, q: 'Can I send packages?', a: "Yes! Use the 'Send a Package' service. You'll be matched with a nearby biker for fast, reliable delivery." },
    { id: 3, q: 'How do I become a biker/driver?', a: 'Register as a Biker on sign-up. Once verified by our team, toggle Driver Mode from the home screen to start accepting orders.' },
    { id: 4, q: 'How is the fare calculated?', a: 'Fares are calculated at $0.40/km from pickup to delivery, plus a small base fee. You\'ll always see the full estimate before you confirm.' },
    { id: 5, q: 'What if my driver doesn\'t arrive?', a: 'Use the in-app Chat or Call button to contact your driver. If unresolved, submit a support ticket and our team will assist within 24 hours.' },
    { id: 6, q: 'How do I track my delivery?', a: 'Once a driver accepts your order, you can see their real-time location on the map in the app.' },
    { id: 7, q: 'How do I pay?', a: 'Currently we support wallet payments. Top up your in-app wallet and payments are deducted automatically on order completion.' },
    { id: 8, q: 'Can I cancel an order?', a: 'Yes, you can cancel an order before a driver is assigned. Cancellations after assignment may incur a small cancellation fee.' },
];

@Controller('api/support')
export class SupportController {
    /**
     * Get full FAQ list.
     */
    @Get('faq')
    getFAQ() {
        return { success: true, data: FAQ_ITEMS };
    }

    /**
     * Submit a support ticket.
     */
    @Post('ticket')
    createTicket(@Body() body: { userId: number; message: string; category?: string; orderId?: number }) {
        console.log(`🎫 Support ticket from user ${body.userId} [${body.category || 'general'}]: ${body.message}`);
        const ticketId = `TKT-${Math.floor(Date.now() / 1000)}-${Math.floor(Math.random() * 9000 + 1000)}`;
        // TODO: Save to DB + email notification to support team
        return {
            success: true,
            ticketId,
            message: `Ticket ${ticketId} received. Our team will respond within 24 hours.`,
        };
    }

    /**
     * Get the status of a support ticket.
     */
    @Get('ticket/:ticketId')
    getTicketStatus(@Param('ticketId') ticketId: string) {
        // TODO: Query DB for real ticket status
        return {
            success: true,
            data: {
                ticketId,
                status: 'open',
                message: 'Your ticket is being reviewed by our support team.',
            },
        };
    }

    /**
     * Submit feedback/rating for a trip.
     */
    @Post('feedback')
    submitFeedback(@Body() body: {
        userId: number;
        orderId: number;
        rating: number;
        comment?: string;
        tags?: string[];
        tipCents?: number;
    }) {
        console.log(`⭐ Feedback from user ${body.userId} for order ${body.orderId}: ${body.rating}/5`);
        if (body.comment) console.log(`   Comment: ${body.comment}`);
        if (body.tags?.length) console.log(`   Tags: ${body.tags.join(', ')}`);
        if (body.tipCents) console.log(`   Tip: $${(body.tipCents / 100).toFixed(2)}`);
        // TODO: Save to trips table (customer_rating, customer_review)
        // TODO: Update driver's average rating in users table
        return { success: true, message: 'Thank you for your feedback!' };
    }
}
