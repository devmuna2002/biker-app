import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { DashboardService } from './dashboard.service';
import { Public } from '../common/public.decorator';

@Controller('api/dashboard')
export class DashboardController {
    constructor(private readonly dashboard: DashboardService) {}

    @Public()
    @Get('init')
    init(
        @CurrentUser() user: any,
        @Query('lat') lat: string,
        @Query('lng') lng: string,
        @Query('radiusKm') radiusKm?: string,
        @Query('radius') radius?: string,
    ) {
        const nLat = Number(lat);
        const nLng = Number(lng);
        if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) throw new BadRequestException('Invalid coordinates');
        const r = radiusKm ?? radius;
        const radiusNum = r ? Number(r) : Number(process.env.DRIVER_SEARCH_RADIUS_KM || 5);
        const radiusKmResolved = Number.isFinite(radiusNum) && radiusNum > 0
            ? radiusNum
            : Number(process.env.DRIVER_SEARCH_RADIUS_KM || 5);
        
        // If no user, pass null or 0 as userId
        const userId = user?.id || 0;
        return this.dashboard.init(userId, { lat: nLat, lng: nLng, radiusKm: radiusKmResolved });
    }
}
