import { Controller, Post, Get, Param, Body, UseGuards, Req } from '@nestjs/common';
import { RideCompletionService } from './ride-completion.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/rides')
export class RideCompletionController {
    constructor(private readonly rideCompletionService: RideCompletionService) {}

    /**
     * Complete a ride and calculate fees
     */
    @Post('complete/:rideId')
    @UseGuards(JwtAuthGuard)
    async completeRide(
        @Param('rideId') rideId: number,
        @Body()
        body: {
            finalFareCents: number;
            platformFeeCents?: number;
        },
    ) {
        return await this.rideCompletionService.completeRide(
            rideId,
            body.finalFareCents,
            body.platformFeeCents,
        );
    }

    /**
     * Get ride details with associated fees and payments
     */
    @Get(':rideId/details')
    @UseGuards(JwtAuthGuard)
    async getRideDetails(@Param('rideId') rideId: number) {
        return await this.rideCompletionService.getRideDetails(rideId);
    }

    /**
     * Get biker's pending fees (earnings waiting to be paid out)
     */
    @Get('biker/fees/pending')
    @UseGuards(JwtAuthGuard)
    async getBikerPendingFees(@Req() req: any) {
        const bikerId = req.user?.id;
        return await this.rideCompletionService.getBikerPendingFees(bikerId);
    }

    /**
     * Mark a fee as paid (after payment processor confirmation)
     */
    @Post('fees/:feeId/mark-paid')
    @UseGuards(JwtAuthGuard)
    async markFeeAsPaid(@Param('feeId') feeId: string) {
        return await this.rideCompletionService.markFeeAsPaid(feeId);
    }
}
