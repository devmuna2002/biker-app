import { Controller, Post, Get, Body, Query, UseGuards, Req } from '@nestjs/common';
import { BikerLocationService } from './biker-location.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/location')
export class BikerLocationController {
    constructor(private readonly bikerLocationService: BikerLocationService) {}

    /**
     * Update biker's current location (called every 3 seconds)
     */
    @Post('update')
    @UseGuards(JwtAuthGuard)
    async updateLocation(
        @Req() req: any,
        @Body()
        body: {
            latitude: number;
            longitude: number;
            heading?: number;
            speed?: number;
            accuracy?: number;
        },
    ) {
        const bikerId = req.user?.id; // From JWT token
        return await this.bikerLocationService.updateBikerLocation(
            bikerId,
            body.latitude,
            body.longitude,
            body.heading,
            body.speed,
            body.accuracy,
        );
    }

    /**
     * Get nearby bikers
     * GET /api/location/nearby?lat=40.7128&lng=-74.0060&radius=5&limit=20
     */
    @Get('nearby')
    async getNearbyBikers(
        @Query('lat') latitude: number,
        @Query('lng') longitude: number,
        @Query('radius') radius: number = 5,
        @Query('limit') limit: number = 20,
    ) {
        const bikerLocations = await this.bikerLocationService.getNearbyBikers(
            parseFloat(latitude as any),
            parseFloat(longitude as any),
            parseFloat(radius as any),
            parseInt(limit as any),
        );

        // Map to include distance calculation
        return {
            count: bikerLocations.length,
            bikers: bikerLocations.map((bl) => ({
                ...bl,
                distanceKm: this.calculateDistance(
                    parseFloat(latitude as any),
                    parseFloat(longitude as any),
                    bl.latitude,
                    bl.longitude,
                ),
            })),
        };
    }

    /**
     * Get specific biker's current location (for customer tracking)
     */
    @Get('biker/:bikerId')
    async getBikerLocation(@Query('bikerId') bikerId: string) {
        return await this.bikerLocationService.getBikerCurrentLocation(bikerId);
    }

    /**
     * Helper: Calculate distance between two coordinates using Haversine formula
     */
    private calculateDistance(
        lat1: number,
        lon1: number,
        lat2: number,
        lon2: number,
    ): number {
        const R = 6371; // Earth's radius in km
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((lat1 * Math.PI) / 180) *
                Math.cos((lat2 * Math.PI) / 180) *
                Math.sin(dLon / 2) *
                Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
}
