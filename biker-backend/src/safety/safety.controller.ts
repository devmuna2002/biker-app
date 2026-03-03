import { Controller, Post, Get, Body, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { SafetyService } from './safety.service';

@Controller('api/safety')
export class SafetyController {
    constructor(private readonly safetyService: SafetyService) { }

    /**
     * Trigger an SOS alert for a user at a given location.
     * Notifies trusted contacts and emergency services.
     */
    @Post('sos')
    triggerSOS(@Body() body: { userId: number; location: { lat: number; lng: number }; message?: string }) {
        return this.safetyService.triggerSOS(body.userId, body.location, body.message);
    }

    /**
     * Generate a shareable tracking URL for a specific order (for trusted contacts).
     */
    @Get('track/:orderId')
    getTrackingUrl(@Param('orderId') orderId: string) {
        return this.safetyService.generateTrackingUrl(+orderId);
    }

    /**
     * Add a trusted contact for a user.
     */
    @Post('contacts')
    addContact(@Body() body: { userId: number; name: string; phone: string; email?: string }) {
        return this.safetyService.addContact(
            { id: body.userId } as any,
            body.name,
            body.phone,
            body.email,
        );
    }

    /**
     * Get all trusted contacts for a user.
     */
    @Get('contacts/:userId')
    getContacts(@Param('userId') userId: string) {
        return this.safetyService.getContacts(+userId);
    }

    /**
     * Remove a trusted contact.
     */
    @Delete('contacts/:contactId')
    removeContact(@Param('contactId') contactId: string) {
        return this.safetyService.removeContact(+contactId);
    }

    /**
     * Report a safety incident (e.g., unsafe ride, harassment, accident).
     */
    @Post('report')
    reportIncident(
        @Body() body: {
            userId: number;
            orderId?: number;
            type: 'unsafe_ride' | 'harassment' | 'accident' | 'other';
            description: string;
        },
    ) {
        return this.safetyService.reportIncident(body.userId, body.orderId, body.type, body.description);
    }

    /**
     * Get safety tips for riders/customers.
     */
    @Get('tips')
    getSafetyTips() {
        return this.safetyService.getSafetyTips();
    }
}
