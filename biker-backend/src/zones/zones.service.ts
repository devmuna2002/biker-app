import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GeoZone } from './geo-zone.entity';
import { ServiceType } from '../orders/order.entity';

@Injectable()
export class ZonesService {
    constructor(@InjectRepository(GeoZone) private readonly repo: Repository<GeoZone>) { }

    async findZone(lat: number, lng: number) {
        const zone = await this.repo
            .createQueryBuilder('z')
            .where('z.isActive = true')
            .andWhere(':lat BETWEEN z.minLat AND z.maxLat', { lat })
            .andWhere(':lng BETWEEN z.minLng AND z.maxLng', { lng })
            .orderBy('z.createdAt', 'DESC')
            .getOne();

        // If no specific zone found, return global zone
        if (!zone) {
            return this.repo.findOne({ where: { code: 'GLOBAL' } });
        }
        return zone;
    }

    isServiceEnabled(zone: GeoZone | null, serviceType: ServiceType) {
        // If no zone, enable all services by default
        if (!zone || !zone.isActive) {
            return true;
        }
        const enabledServices = zone.enabledServices || [];
        // If no services explicitly enabled, enable all by default
        if (enabledServices.length === 0) {
            return true;
        }
        return enabledServices.includes(serviceType);
    }

    async ensureGlobalZone() {
        let existing = await this.repo.findOne({ where: { code: 'GLOBAL' } });
        if (existing) return existing;

        existing = this.repo.create({
            code: 'GLOBAL',
            name: 'Global Service Area',
            minLat: -90,
            maxLat: 90,
            minLng: -180,
            maxLng: 180,
            enabledServices: [ServiceType.BIKE, ServiceType.COURIER, ServiceType.LOCAL_SERVICES],
            isActive: true,
        });
        return this.repo.save(existing);
    }
}
