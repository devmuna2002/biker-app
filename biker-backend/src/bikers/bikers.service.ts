import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Biker } from './biker.entity';
import { DriverLocationCacheService } from '../drivers/driver-location-cache.service';

@Injectable()
export class BikersService implements OnModuleInit {
    private readonly logger = new Logger(BikersService.name);

    constructor(
        @InjectRepository(Biker)
        private bikersRepository: Repository<Biker>,
        private readonly cache: DriverLocationCacheService,
    ) { }

    /**
     * Periodic staleness cleanup: if a biker is marked online in the DB
     * but has no fresh cache entry, set them offline automatically.
     * This handles cases where the app crashes or loses network without
     * calling setOnline(false).
     */
    onModuleInit() {
        // Run cleanup every 2 minutes
        setInterval(() => this.cleanupStaleBikers(), 2 * 60 * 1000);
        // Also run once at startup after a longer delay to allow bikers to re-ping
        setTimeout(() => this.cleanupStaleBikers(), 60_000);
    }

    private async cleanupStaleBikers() {
        try {
            const onlineBikers = await this.bikersRepository.find({
                where: { isOnline: true },
            });
            if (onlineBikers.length === 0) return;

            for (const biker of onlineBikers) {
                const cached = await this.cache.get(biker.id);
                if (!cached) {
                    // No cache entry → biker has not sent location recently → mark offline
                    biker.isOnline = false;
                    biker.isAvailable = false;
                    await this.bikersRepository.save(biker);
                    this.logger.log(`Stale biker ${biker.id} auto-set to offline (no fresh cache entry)`);
                }
            }
        } catch (e) {
            this.logger.warn(`Staleness cleanup error: ${e.message}`);
        }
    }

    async findNearby(lat: number, lng: number, radiusKm: number = 5): Promise<Biker[]> {
        // Approximate degrees from km (1 deg ~ 111.32 km)
        // Bypassing PostGIS SRID lookup errors by using flat geometry search
        const radiusDeg = radiusKm / 111.32;
        return this.bikersRepository
            .createQueryBuilder('biker')
            .leftJoinAndSelect('biker.user', 'user')
            .where('ST_DWithin(biker."lastKnownLocation", ST_SetSRID(ST_MakePoint(:lng, :lat), 4326), :radius)', {
                lng,
                lat,
                radius: radiusDeg,
            })
            .andWhere('biker.isOnline = :isOnline', { isOnline: true })
            .andWhere('biker.isAvailable = true')
            .getMany();
    }

    async updateLocation(bikerId: number, lat: number, lng: number) {
        const biker = await this.bikersRepository.findOne({ where: { id: bikerId } });
        if (biker) {
            biker.lastKnownLocation = {
                type: 'Point',
                coordinates: [lng, lat],
            };
            return this.bikersRepository.save(biker);
        }
    }

    async toggleOnlineStatus(bikerId: number) {
        const biker = await this.bikersRepository.findOne({ where: { id: bikerId } });
        if (biker) {
            biker.isOnline = !biker.isOnline;
            return this.bikersRepository.save(biker);
        }
    }

    async findIntercityBikers() {
        return this.bikersRepository.find({
            where: { isOnline: true, hasIntercityPermit: true },
            relations: ['user'],
        });
    }

    async findAvailableByIds(ids: number[]) {
        if (!ids || ids.length === 0) return [];
        return this.bikersRepository.find({
            where: {
                id: In(ids),
                isOnline: true,
                isAvailable: true,
            },
            relations: ['user'],
        });
    }
}
