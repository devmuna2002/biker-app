import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Biker } from './biker.entity';

@Injectable()
export class BikersService {
    constructor(
        @InjectRepository(Biker)
        private bikersRepository: Repository<Biker>,
    ) { }

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
