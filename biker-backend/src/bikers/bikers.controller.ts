import { Controller, Get, Query, Patch, Param, Body } from '@nestjs/common';
import { BikersService } from './bikers.service';
import { DriverLocationCacheService } from '../drivers/driver-location-cache.service';

@Controller('bikers')
export class BikersController {
    constructor(
        private readonly bikersService: BikersService,
        private readonly cache: DriverLocationCacheService,
    ) { }

    @Get('nearby')
    findNearby(
        @Query('lat') lat: number,
        @Query('lng') lng: number,
        @Query('radius') radius: number,
    ) {
        return this.bikersService.findNearby(Number(lat), Number(lng), Number(radius));
    }

    @Patch(':id/location')
    updateLocation(
        @Param('id') id: number,
        @Body() body: { lat: number; lng: number },
    ) {
        const bikerId = Number(id);
        const lat = Number(body.lat);
        const lng = Number(body.lng);
        this.cache.set(bikerId, { lat, lng, ts: Date.now() });
        return this.bikersService.updateLocation(bikerId, lat, lng);
    }

    @Patch(':id/toggle-online')
    toggleOnline(@Param('id') id: string) {
        return this.bikersService.toggleOnlineStatus(+id);
    }

    @Get('intercity')
    findIntercity() {
        return this.bikersService.findIntercityBikers();
    }
}
