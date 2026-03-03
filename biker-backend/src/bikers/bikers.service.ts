import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Biker } from './biker.entity';

@Injectable()
export class BikersService {
    constructor(
        @InjectRepository(Biker)
        private bikersRepository: Repository<Biker>,
    ) { }

    async findNearby(lat: number, lng: number, radiusKm: number = 5): Promise<Biker[]> {
        // Use geography for meter-based radius.
        return this.bikersRepository
            .createQueryBuilder('biker')
            .leftJoinAndSelect('biker.user', 'user')
            .where(
                'ST_DWithin(biker."lastKnownLocation"::geography, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, :radius)',
                { lng, lat, radius: radiusKm * 1000 },
            )
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
            where: ids.map((id) => ({ id, isOnline: true, isAvailable: true })) as any,
            relations: ['user'],
        });
    }
}
