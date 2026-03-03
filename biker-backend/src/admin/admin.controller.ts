import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AdminService, DashboardStats } from './admin.service';
import { RiderStatus } from './admin.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/roles.decorator';

@Controller('api/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
    constructor(private readonly adminService: AdminService) {}

    @Get('dashboard')
    async getDashboard(): Promise<DashboardStats> {
        return this.adminService.getDashboardStats();
    }

    @Get('riders')
    async getAllRiders(@Query('status') status?: RiderStatus) {
        return this.adminService.getAllRiders(status);
    }

    @Post('riders/:rider_id/approve')
    async approveRider(@Param('rider_id') rider_id: string) {
        const rider = await this.adminService.approveRider(rider_id);
        return { message: 'Rider approved', rider };
    }

    @Post('riders/:rider_id/reject')
    async rejectRider(
        @Param('rider_id') rider_id: string,
        @Body() body: { reason: string }
    ) {
        const rider = await this.adminService.rejectRider(rider_id, body.reason);
        return { message: 'Rider rejected', rider };
    }

    @Post('riders/:rider_id/suspend')
    async suspendRider(@Param('rider_id') rider_id: string) {
        const rider = await this.adminService.suspendRider(rider_id);
        return { message: 'Rider suspended', rider };
    }

    @Get('trips')
    async getAllTrips(
        @Query('limit') limit?: number,
        @Query('offset') offset?: number
    ) {
        return this.adminService.getAllTrips(limit, offset);
    }

    @Get('trips/:trip_id')
    async getTrip(@Param('trip_id') trip_id: string) {
        return this.adminService.getTripById(trip_id);
    }

    @Get('earnings')
    async getEarnings() {
        const total_earnings = await this.adminService.getTotalEarnings();
        return { total_earnings };
    }

    @Get('rider/:rider_id/earnings')
    async getRiderEarnings(@Param('rider_id') rider_id: string) {
        const earnings = await this.adminService.getRiderEarnings(rider_id);
        return { rider_id, earnings };
    }
}
