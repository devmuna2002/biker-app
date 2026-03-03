import { Injectable } from '@nestjs/common';
import { haversineKm } from '../common/geo';

@Injectable()
export class GpsSpoofService {
    isSuspicious(prev: { lat: number; lng: number; ts: number } | null, next: { lat: number; lng: number; ts: number; accuracyM?: number }) {
        if (!prev) return false;
        const dt = (next.ts - prev.ts) / 1000;
        if (dt <= 0) return true;
        const dKm = haversineKm({ lat: prev.lat, lng: prev.lng }, { lat: next.lat, lng: next.lng });
        const speedMps = (dKm * 1000) / dt;
        if (speedMps > Number(process.env.GPS_MAX_SPEED_MPS || 55)) return true;
        if ((next.accuracyM ?? 0) > Number(process.env.GPS_MAX_ACCURACY_M || 200)) return true;
        return false;
    }
}
