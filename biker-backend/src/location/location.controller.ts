import { Controller, Get, Query, BadRequestException, UseGuards } from '@nestjs/common';
import { LocationService } from './location.service';
import { RateLimit } from '../common/rate-limit.decorator';
import { RateLimitGuard } from '../common/rate-limit.guard';
import { Public } from '../common/public.decorator';

@Controller('api/location')
export class LocationController {
    constructor(private readonly location: LocationService) { }

    @UseGuards(RateLimitGuard)
    @RateLimit({ points: 30, durationSeconds: 60, keyPrefix: 'autocomplete' })
    @Public()
    @Get('autocomplete')
    async autocomplete(
        @Query('query') query: string,
        @Query('lat') lat?: string,
        @Query('lng') lng?: string,
    ) {
        if (!query || query.trim().length < 2) throw new BadRequestException('Query too short');
        const nLat = lat != null ? Number(lat) : undefined;
        const nLng = lng != null ? Number(lng) : undefined;
        const suggestions = await this.location.autocomplete(query.trim(), nLat, nLng);
        return { success: true, data: { suggestions } };
    }

    @Public()
    @Get('nearby-providers')
    async nearbyProviders(
        @Query('lat') lat: string,
        @Query('lng') lng: string,
        @Query('kind') kind: string,
        @Query('radiusM') radiusM?: string,
        @Query('limit') limit?: string,
    ) {
        if (!lat || !lng || !kind) throw new BadRequestException('Missing parameters');
        const providers = await this.location.findNearbyProviders(
            Number(lat),
            Number(lng),
            kind,
            radiusM ? Number(radiusM) : undefined,
            limit ? Number(limit) : undefined,
        );
        return { success: true, data: { providers } };
    }
}
