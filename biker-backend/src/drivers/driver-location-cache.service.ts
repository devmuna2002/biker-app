import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { haversineKm } from '../common/geo';

type DriverLoc = {
    lat: number;
    lng: number;
    speedMps?: number;
    headingDeg?: number;
    accuracyM?: number;
    ts: number;
};

@Injectable()
export class DriverLocationCacheService {
    private readonly redis: Redis | null;
    private readonly mem = new Map<number, DriverLoc>();
    private readonly geoKey = 'drivers:geo';

    constructor() {
        const url = process.env.REDIS_URL;
        this.redis = url ? new Redis(url, { maxRetriesPerRequest: 2 }) : null;
    }

    async set(driverId: number, loc: DriverLoc) {
        this.mem.set(driverId, loc);
        if (!this.redis) return;
        await this.redis
            .multi()
            .set(`driver:loc:${driverId}`, JSON.stringify(loc), 'EX', 90) // Increased to 90s for more stability
            .geoadd(this.geoKey, loc.lng, loc.lat, String(driverId))
            .exec();
    }

    async remove(driverId: number) {
        this.mem.delete(driverId);
        if (!this.redis) return;
        await this.redis
            .multi()
            .del(`driver:loc:${driverId}`)
            .zrem(this.geoKey, String(driverId))
            .exec();
    }

    async get(driverId: number): Promise<DriverLoc | null> {
        if (this.redis) {
            const raw = await (this.redis as any).get(`driver:loc:${driverId}`);
            if (raw) return JSON.parse(raw);
        }
        return this.mem.get(driverId) || null;
    }

    async nearby(lat: number, lng: number, radiusKm: number, limit: number = 30) {
        if (this.redis) {
            const res = (await (this.redis as any).georadius(
                this.geoKey,
                lng,
                lat,
                radiusKm,
                'km',
                'WITHDIST',
                'COUNT',
                limit,
                'ASC',
            )) as Array<[string, string]>;

            return (res || []).map(([id, distKm]) => ({
                driverId: Number(id),
                distanceKm: Number(distKm),
            }));
        }

        const out: Array<{ driverId: number; distanceKm: number }> = [];
        for (const [driverId, loc] of this.mem.entries()) {
            const d = haversineKm({ lat, lng }, { lat: loc.lat, lng: loc.lng });
            if (d <= radiusKm) out.push({ driverId, distanceKm: Math.round(d * 100) / 100 });
        }
        out.sort((a, b) => a.distanceKm - b.distanceKm);
        return out.slice(0, limit);
    }
}
