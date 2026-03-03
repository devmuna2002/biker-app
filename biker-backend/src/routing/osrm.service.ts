import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export interface OSRMRouteResult {
    distance_km: number;
    duration_min: number;
    polyline: string;
    geometry: any;
}

export interface OSRMNearbyResult {
    latitude: number;
    longitude: number;
    distance_km: number;
}

@Injectable()
export class OsrmService {
    private readonly logger = new Logger(OsrmService.name);
    
    // OSRM demo server - replace with your own instance in production
    private readonly OSRM_HOST = process.env.OSRM_HOST || 'http://router.project-osrm.org';
    
    // Alternative: Use your own OSRM server
    // private readonly OSRM_HOST = process.env.OSRM_HOST || 'http://localhost:5000';

    async getRoute(
        pickupLat: number,
        pickupLng: number,
        dropoffLat: number,
        dropoffLng: number
    ): Promise<OSRMRouteResult> {
        try {
            const url = `${this.OSRM_HOST}/route/v1/driving/${pickupLng},${pickupLat};${dropoffLng},${dropoffLat}`;
            const params = {
                overview: 'full',
                geometries: 'polyline',
                steps: 'false',
                annotations: 'false',
            };

            const response = await axios.get(url, { params });
            
            if (response.data.code !== 'Ok') {
                throw new Error(`OSRM error: ${response.data.code}`);
            }

            const route = response.data.routes[0];
            
            return {
                distance_km: parseFloat((route.distance / 1000).toFixed(2)),
                duration_min: Math.ceil(route.duration / 60),
                polyline: route.geometry,
                geometry: route.geometry,
            };
        } catch (error) {
            this.logger.error(`OSRM route error: ${error.message}`);
            throw error;
        }
    }

    async getDistanceAndDuration(
        pickupLat: number,
        pickupLng: number,
        dropoffLat: number,
        dropoffLng: number
    ): Promise<{ distance_km: number; duration_min: number }> {
        try {
            const url = `${this.OSRM_HOST}/route/v1/driving/${pickupLng},${pickupLat};${dropoffLng},${dropoffLat}`;
            const params = {
                overview: 'false',
            };

            const response = await axios.get(url, { params });
            
            if (response.data.code !== 'Ok') {
                throw new Error(`OSRM error: ${response.data.code}`);
            }

            const route = response.data.routes[0];
            
            return {
                distance_km: parseFloat((route.distance / 1000).toFixed(2)),
                duration_min: Math.ceil(route.duration / 60),
            };
        } catch (error) {
            this.logger.error(`OSRM distance error: ${error.message}`);
            throw error;
        }
    }

    async getTableDistance(
        coordinates: Array<[number, number]>
    ): Promise<number[][]> {
        try {
            const coordString = coordinates
                .map(coord => `${coord[1]},${coord[0]}`)
                .join(';');

            const url = `${this.OSRM_HOST}/table/v1/driving/${coordString}`;
            const params = {
                sources: 'all',
                destinations: 'all',
            };

            const response = await axios.get(url, { params });
            
            if (response.data.code !== 'Ok') {
                throw new Error(`OSRM error: ${response.data.code}`);
            }

            // Convert meters to km
            return response.data.durations.map((row: number[]) =>
                row.map((val: number) => val / 1000)
            );
        } catch (error) {
            this.logger.error(`OSRM table error: ${error.message}`);
            throw error;
        }
    }

    async findNearbyRiders(
        centerLat: number,
        centerLng: number,
        radiusKm: number = 5
    ): Promise<OSRMNearbyResult[]> {
        // Note: OSRM doesn't have native "nearby" search
        // This is a placeholder - in production use PostGIS or a spatial database
        // Or use a dedicated nearest-node search
        
        this.logger.log(`Finding riders near ${centerLat}, ${centerLng} within ${radiusKm}km`);
        
        // Return empty array - implement with PostGIS for production
        return [];
    }

    async getTripGeometry(
        pickupLat: number,
        pickupLng: number,
        dropoffLat: number,
        dropoffLng: number,
        waypoints: Array<[number, number]> = []
    ): Promise<any> {
        try {
            let coordString = `${pickupLng},${pickupLat};`;
            
            if (waypoints.length > 0) {
                coordString += waypoints
                    .map(wp => `${wp[1]},${wp[0]}`)
                    .join(';');
                coordString += ';';
            }
            
            coordString += `${dropoffLng},${dropoffLat}`;

            const url = `${this.OSRM_HOST}/route/v1/driving/${coordString}`;
            const params = {
                overview: 'full',
                geometries: 'geojson',
                steps: 'true',
            };

            const response = await axios.get(url, { params });
            
            if (response.data.code !== 'Ok') {
                throw new Error(`OSRM error: ${response.data.code}`);
            }

            return response.data.routes[0].geometry;
        } catch (error) {
            this.logger.error(`OSRM geometry error: ${error.message}`);
            throw error;
        }
    }
}
