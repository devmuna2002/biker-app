import { Controller, Post, Get, Body, Param, Put, UseGuards, Request } from '@nestjs/common';
import { TripsService, CalculateTripDto } from './trips.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../common/public.decorator';

@Controller('api/trips')
export class TripsController {
    constructor(private readonly tripsService: TripsService) {}

    @Public()
    @Post('calculate')
    async calculateTrip(@Body() dto: CalculateTripDto) {
        return this.tripsService.calculateTrip(dto);
    }

    @Post(':trip_id/start')
    @UseGuards(JwtAuthGuard)
    async startTrip(@Param('trip_id') trip_id: string, @Request() req) {
        const rider_id = req.user.userId;
        return this.tripsService.startTrip(trip_id, rider_id);
    }

    @Post(':trip_id/complete')
    @UseGuards(JwtAuthGuard)
    async completeTrip(@Param('trip_id') trip_id: string) {
        return this.tripsService.completeTrip(trip_id);
    }

    @Post(':trip_id/cancel')
    @UseGuards(JwtAuthGuard)
    async cancelTrip(
        @Param('trip_id') trip_id: string,
        @Body() body: { reason?: string }
    ) {
        const user = body['user'];
        const cancelled_by = user?.role === 'rider' ? 'rider' : 'customer';
        return this.tripsService.cancelTrip(trip_id, cancelled_by, body.reason);
    }

    @Get(':trip_id')
    @UseGuards(JwtAuthGuard)
    async getTrip(@Param('trip_id') trip_id: string) {
        return this.tripsService.getTripById(trip_id);
    }

    @Get('customer/:customer_id')
    @UseGuards(JwtAuthGuard)
    async getCustomerTrips(@Param('customer_id') customer_id: string) {
        return this.tripsService.getCustomerTrips(customer_id);
    }

    @Get('rider/:rider_id')
    @UseGuards(JwtAuthGuard)
    async getRiderTrips(@Param('rider_id') rider_id: string) {
        return this.tripsService.getRiderTrips(rider_id);
    }

    @Get('pending/all')
    @UseGuards(JwtAuthGuard)
    async getPendingTrips() {
        return this.tripsService.getPendingTrips();
    }

    @Post(':trip_id/accept')
    @UseGuards(JwtAuthGuard)
    async acceptTrip(@Param('trip_id') trip_id: string, @Request() req) {
        const rider_id = req.user.userId;
        return this.tripsService.acceptTrip(trip_id, rider_id);
    }
}
