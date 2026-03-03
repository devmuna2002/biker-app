import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeliveryService } from './delivery-service.entity';
import { ServiceType } from '../orders/order.entity';

@Injectable()
export class ServiceCatalogService {
    constructor(
        @InjectRepository(DeliveryService)
        private readonly repo: Repository<DeliveryService>,
    ) { }

    async getByType(type: ServiceType) {
        const service = await this.repo.findOne({ where: { type, isActive: true } });
        if (!service) throw new NotFoundException('Service not found');
        return {
            success: true,
            data: {
                type: service.type,
                isActive: service.isActive,
                pricing: {
                    baseFareCents: service.baseFareCents,
                    perKmCents: service.perKmCents,
                    courierRules: service.courierRules,
                    localServiceRules: service.localServiceRules,
                    currency: service.currency,
                },
                capacityRules: service.capacityRules,
                etaModel: service.etaModel,
            },
        };
    }

    async ensureSeedDefaults() {
        const overwrite = process.env.SEED_OVERWRITE === 'true';
        const defaults: Array<Partial<DeliveryService>> = [
            {
                type: ServiceType.BIKE,
                isActive: true,
                baseFareCents: 200,
                perKmCents: 120,
                capacityRules: { maxWeightKg: 10, maxVolumeM3: 0.05 },
                etaModel: { baseMinutes: 5, minutesPerKm: 3 },
                currency: 'USD',
            },
            {
                type: ServiceType.COURIER,
                isActive: true,
                baseFareCents: 300,
                perKmCents: 140,
                courierRules: { perKgCents: 30, minWeightKg: 0, maxWeightKg: 30 },
                capacityRules: { maxWeightKg: 30, maxVolumeM3: 0.15 },
                etaModel: { baseMinutes: 8, minutesPerKm: 3 },
                currency: 'USD',
            },
            {
                type: ServiceType.LOCAL_SERVICES,
                isActive: true,
                // Repurposed for a biker-friendly service (eg. Food). Keep as base + distance.
                baseFareCents: 350,
                perKmCents: 150,
                localServiceRules: {
                    perM3Cents: 0,
                    vehicleTypeMultipliers: { local_services: 1.0 },
                    minVolumeM3: 0,
                    maxVolumeM3: 0,
                },
                capacityRules: { maxWeightKg: 15, maxVolumeM3: 0.1 },
                etaModel: { baseMinutes: 7, minutesPerKm: 3 },
                currency: 'USD',
            },
        ];

        for (const d of defaults) {
            const existing = await this.repo.findOne({ where: { type: d.type as any } });
            if (!existing) {
                await this.repo.save(this.repo.create(d));
                continue;
            }
            if (overwrite) {
                await this.repo.save({ ...existing, ...d } as any);
            }
        }
    }
}
