import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { BikersService } from '../bikers/bikers.service';
import { DriverLocationCacheService } from './driver-location-cache.service';
import { LocationService } from '../location/location.service';
import { Public } from '../common/public.decorator';
import { latLngFromPoint } from '../common/geo';

@Controller('api/drivers')
export class DriversController {
    constructor(
        private readonly bikers: BikersService,
        private readonly cache: DriverLocationCacheService,
        private readonly location: LocationService,
    ) { }

    @Public()
    @Get('nearby')
    async nearby(
        @Query('lat') lat: string,
        @Query('lng') lng: string,
        @Query('radiusKm') radiusKm?: string,
        @Query('radius') radius?: string,
        @Query('includePickupAddress') includePickupAddress?: string,
        @Query('serviceType') serviceType?: string,
    ) {
        const nLat = Number(lat);
        const nLng = Number(lng);
        if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) throw new BadRequestException('Invalid coordinates');
        const radiusValue = radiusKm ?? radius;
        const radiusNum = radiusValue ? Number(radiusValue) : Number(process.env.DRIVER_SEARCH_RADIUS_KM || 5);
        const radiusNumSafe = Number.isFinite(radiusNum) && radiusNum > 0 ? radiusNum : Number(process.env.DRIVER_SEARCH_RADIUS_KM || 5);

        const cached = await this.cache.nearby(nLat, nLng, radiusNumSafe, 50);
        const driverIds = cached.map((c) => c.driverId);

        let drivers = [] as any[];
        if (driverIds.length > 0) {
            const rows = await this.bikers.findAvailableByIds(driverIds);
            const byId = new Map(rows.map((r) => [r.id, r]));
            drivers = cached
                .map((c) => {
                    const r = byId.get(c.driverId);
                    if (!r) return null;
                    const loc = c.loc;
                    const coords = loc ? { lat: loc.lat, lng: loc.lng } : latLngFromPoint(r.lastKnownLocation);
                    return {
                        id: r.id,
                        name: r.user?.name,
                        vehicleType: r.vehicleType,
                        distanceKm: c.distanceKm,
                        coords,
                    };
                })
                .filter(Boolean);
        } else {
            const rows = await this.bikers.findNearby(nLat, nLng, radiusNumSafe);
            drivers = rows.map((r) => ({
                id: r.id,
                name: r.user?.name,
                vehicleType: r.vehicleType,
                coords: latLngFromPoint(r.lastKnownLocation),
            }));

            // Filter by service type if provided
            if (serviceType) {
                drivers = drivers.filter((d) => {
                    if (serviceType === 'bike') return d.vehicleType === 'bike';
                    if (serviceType === 'courier') return d.vehicleType === 'courier';
                    if (serviceType === 'local_services') return d.vehicleType === 'local_services';
                    return true;
                });
            }
        }

        const pickupAddress =
            includePickupAddress === 'true' ? await this.location.reverseGeocode(nLat, nLng) : null;

        return {
            success: true,
            data: {
                pickup: { lat: nLat, lng: nLng, address: pickupAddress },
                radiusKm: radiusNumSafe,
                drivers,
            },
        };
    }
}
