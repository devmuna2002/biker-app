import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import axios from 'axios';
import { Public } from '../common/public.decorator';

@Controller('api/routes')
@Public()
export class RoutesController {

    @Get('directions')
    async getDirections(
        @Query('origin') origin: string,
        @Query('destination') destination: string,
        @Query('serviceType') serviceType?: string,
    ) {
        if (!origin || !destination) {
            throw new BadRequestException('Origin and destination are required');
        }

        try {
            const [originCoords, destCoords] = await Promise.all([
                this.resolveCoords(origin),
                this.resolveCoords(destination),
            ]);

            if (!originCoords || !destCoords) {
                return {
                    success: false,
                    message: 'Could not resolve coordinates for origin or destination',
                };
            }

            const route = await this.getRoute(originCoords, destCoords, serviceType);
            return {
                success: true,
                routes: [route],
            };
        } catch (error) {
            console.error('Directions error:', error.message);
            return {
                success: false,
                message: error.message || 'Failed to get directions',
                routes: [],
            };
        }
    }

    private async resolveCoords(input: string): Promise<{ lat: number; lng: number } | null> {
        if (/^-?\d+\.?\d*,-?\d+\.?\d*$/.test(input)) {
            const [lat, lng] = input.split(',').map(Number);
            if (Number.isFinite(lat) && Number.isFinite(lng)) {
                return { lat, lng };
            }
        }

        try {
            const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(input)}&limit=1`;
            const response = await axios.get(nominatimUrl, {
                headers: { 'User-Agent': 'BikerApp/1.0' },
                timeout: 8000,
            });
            const data = response.data;
            if (data && data.length > 0) {
                return {
                    lat: Number(data[0].lat),
                    lng: Number(data[0].lon),
                };
            }
        } catch {
            return null;
        }
        return null;
    }

    private async getRoute(
        origin: { lat: number; lng: number },
        dest: { lat: number; lng: number },
        serviceType?: string,
    ) {
        // Try multiple OSRM servers - NO STRAIGHT LINE FALLBACK
        const osrmConfigs = [
            { host: 'https://router.project-osrm.org', path: '/route/v1/driving' },
            { host: 'https://routing.openstreetmap.de', path: '/r/route/v1/driving' },
            { host: 'https://tile.osmz.ru', path: '/routing/v1/driving' },
        ];

        let lastError = null;

        for (const config of osrmConfigs) {
            try {
                const url = `${config.host}${config.path}/${origin.lng},${origin.lat};${dest.lng},${dest.lat}`;
                const params = {
                    overview: 'full',
                    geometries: 'geojson',
                };

                const response = await axios.get(url, { params, timeout: 10000 });
                
                if (response.data.code === 'Ok' && response.data.routes?.[0]) {
                    const route = response.data.routes[0];
                    console.log('OSRM success:', config.host);
                    
                    return {
                        distanceKm: route.distance / 1000,
                        durationMin: Math.round(route.duration / 60),
                        points: route.geometry.coordinates.map((c: number[]) => ({
                            latitude: c[1],
                            longitude: c[0],
                        })),
                    };
                }
            } catch (error) {
                console.log(`OSRM ${config.host} failed:`, error.message);
                lastError = error;
                continue;
            }
        }
        
        // NO STRAIGHT LINE - throw error
        throw new Error('Could not find road route. Please check your internet connection.');
    }
}
