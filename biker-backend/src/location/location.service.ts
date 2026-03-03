import { Injectable, Logger } from '@nestjs/common';

type AutocompleteSuggestion = {
    label: string;
    placeId: string;
    lat: number;
    lng: number;
};

/**
 * Maps app-level category names to Nominatim search query strings.
 * This ensures we find appropriate places for each service type.
 */
const KIND_TO_NOMINATIM: Record<string, string> = {
    restaurant: 'restaurant',
    food: 'restaurant',
    grocery: 'supermarket',
    supermarket: 'supermarket',
    pharmacy: 'pharmacy',
    boutique: 'clothes',
    clothing: 'clothes',
    bar: 'bar',
    nightclub: 'nightclub',
    school: 'school',
    church: 'church',
    mosque: 'mosque',
    salon: 'hairdresser',
    spa: 'spa',
    hospital: 'hospital',
    clinic: 'clinic',
    bank: 'bank',
    atm: 'atm',
    petrol: 'fuel',
    fuel: 'fuel',
    hotel: 'hotel',
    gym: 'gym',
    park: 'park',
};

/**
 * Category labels shown to users
 */
const KIND_LABEL: Record<string, string> = {
    restaurant: 'Restaurant',
    grocery: 'Grocery Store',
    pharmacy: 'Pharmacy',
    boutique: 'Boutique',
    bar: 'Bar/Club',
    school: 'School',
    church: 'Church',
    salon: 'Salon/Spa',
};

@Injectable()
export class LocationService {
    private readonly logger = new Logger(LocationService.name);
    private readonly baseUrl = process.env.NOMINATIM_BASE_URL || 'https://nominatim.openstreetmap.org';

    private fetchHeaders = {
        'User-Agent': process.env.HTTP_USER_AGENT || 'biker-backend/1.0',
        'Accept-Language': 'en',
    };

    async autocomplete(query: string, lat?: number, lng?: number): Promise<AutocompleteSuggestion[]> {
        // Radius in degrees — 5.0° ≈ 550 km, covers all of Zimbabwe
        const CITY_DEG = 5.0;

        // Use Photon with strict bounding box — results ONLY from within the user's city
        const baseUrl = 'https://photon.komoot.io/api/';
        const url = new URL(baseUrl);
        url.searchParams.set('q', query);
        url.searchParams.set('limit', '10');

        if (lat != null && lng != null) {
            // bbox=minLng,minLat,maxLng,maxLat — strictly limits results to this box
            const minLng = lng - CITY_DEG;
            const minLat = lat - CITY_DEG;
            const maxLng = lng + CITY_DEG;
            const maxLat = lat + CITY_DEG;
            url.searchParams.set('bbox', `${minLng},${minLat},${maxLng},${maxLat}`);
            // Also add lat/lon for distance-based biasing (works in tandem with bbox)
            url.searchParams.set('lat', String(lat));
            url.searchParams.set('lon', String(lng));
            url.searchParams.set('location_bias_scale', '1.0'); // 1.0 = strong local bias
        }

        try {
            const res = await fetch(url.toString(), { headers: this.fetchHeaders });
            if (!res.ok) return this.fallbackNominatim(query, lat, lng);

            const json = (await res.json()) as any;
            const features = json.features || [];

            return features.map((f: any) => {
                const props = f.properties;
                const coords = f.geometry.coordinates; // [lng, lat]

                // Build a clean, readable label
                const parts = [
                    props.name,
                    props.street,
                    props.district || props.city,
                    props.state,
                ].filter(Boolean);

                return {
                    label: parts.join(', '),
                    placeId: props.osm_id ? String(props.osm_id) : Math.random().toString(36),
                    lat: coords[1],
                    lng: coords[0],
                };
            });
        } catch (e) {
            this.logger.error('Photon autocomplete failed, falling back', e.message);
            return this.fallbackNominatim(query, lat, lng);
        }
    }

    private async fallbackNominatim(query: string, lat?: number, lng?: number): Promise<AutocompleteSuggestion[]> {
        const url = new URL('/search', this.baseUrl);
        url.searchParams.set('q', query);
        url.searchParams.set('format', 'json');
        url.searchParams.set('limit', '10');
        if (lat != null && lng != null) {
            const deg = 5.0; // ~550 km — covers the whole country
            url.searchParams.set('viewbox', `${lng - deg},${lat + deg},${lng + deg},${lat - deg}`);
            url.searchParams.set('bounded', '1'); // strictly within the box
        }

        try {
            const res = await fetch(url.toString(), { headers: this.fetchHeaders });
            const json = (await res.json()) as any[];
            return (json || []).map((r) => ({
                label: r.display_name,
                placeId: String(r.place_id || r.osm_id),
                lat: Number(r.lat),
                lng: Number(r.lon),
            }));
        } catch {
            return [];
        }
    }

    async reverseGeocode(lat: number, lng: number): Promise<string | null> {
        const url = new URL('/reverse', this.baseUrl);
        url.searchParams.set('lat', String(lat));
        url.searchParams.set('lon', String(lng));
        url.searchParams.set('format', 'json');

        try {
            const res = await fetch(url.toString(), { headers: this.fetchHeaders });
            if (!res.ok) return null;
            const json = (await res.json()) as any;
            return json?.display_name || null;
        } catch {
            return null;
        }
    }

    async findNearbyProviders(lat: number, lng: number, kind: string, radiusM: number = 2500, limit: number = 30) {
        // Map the app's category to a Nominatim amenity/query term
        const searchTerm = KIND_TO_NOMINATIM[kind.toLowerCase()] || kind;

        // Strategy 1: search by amenity tag (works for schools, hospitals, etc.)
        const results = await this.searchByAmenityOrQuery(lat, lng, searchTerm, radiusM, limit);

        if (results.length > 0) return results;

        // Strategy 2: fallback – free-text search with broader radius
        return this.searchFreeText(lat, lng, searchTerm, radiusM * 2, limit);
    }

    private async searchByAmenityOrQuery(lat: number, lng: number, term: string, radiusM: number, limit: number) {
        const deg = (radiusM / 1000) / 111;

        // Try amenity-tagged search first
        const amenityUrl = new URL('/search', this.baseUrl);
        amenityUrl.searchParams.set('amenity', term);
        amenityUrl.searchParams.set('format', 'json');
        amenityUrl.searchParams.set('limit', String(Math.min(limit, 50)));
        amenityUrl.searchParams.set('viewbox', `${lng - deg},${lat + deg},${lng + deg},${lat - deg}`);
        amenityUrl.searchParams.set('bounded', '1');
        amenityUrl.searchParams.set('addressdetails', '1');

        try {
            const res = await fetch(amenityUrl.toString(), { headers: this.fetchHeaders });
            if (res.ok) {
                const json = (await res.json()) as any[];
                if (json && json.length > 0) {
                    return this.mapResults(json, lat, lng);
                }
            }
        } catch { /* fall through */ }

        return [];
    }

    private async searchFreeText(lat: number, lng: number, term: string, radiusM: number, limit: number) {
        const deg = (radiusM / 1000) / 111;

        const url = new URL('/search', this.baseUrl);
        url.searchParams.set('q', term);
        url.searchParams.set('format', 'json');
        url.searchParams.set('limit', String(Math.min(limit, 50)));
        url.searchParams.set('viewbox', `${lng - deg},${lat + deg},${lng + deg},${lat - deg}`);
        url.searchParams.set('bounded', '1');
        url.searchParams.set('addressdetails', '1');

        try {
            const res = await fetch(url.toString(), { headers: this.fetchHeaders });
            if (!res.ok) return [];
            const json = (await res.json()) as any[];
            return this.mapResults(json || [], lat, lng);
        } catch {
            return [];
        }
    }

    private mapResults(json: any[], userLat: number, userLng: number) {
        return json.map((r) => {
            const pLat = Number(r.lat);
            const pLng = Number(r.lon);
            const distanceKm = this.haversineKm(userLat, userLng, pLat, pLng);

            // Build a clean name: first part of display_name
            const nameParts = (r.display_name || '').split(',');
            const name = nameParts[0]?.trim() || r.name || 'Unknown';

            return {
                id: String(r.place_id || r.osm_id),
                name,
                address: r.display_name,
                lat: pLat,
                lng: pLng,
                type: r.type,
                class: r.class,
                kind: r.type || r.class,
                distanceKm: Math.round(distanceKm * 100) / 100,
            };
        }).sort((a, b) => a.distanceKm - b.distanceKm);
    }

    private haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
}
