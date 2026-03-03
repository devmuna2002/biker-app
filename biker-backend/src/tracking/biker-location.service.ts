import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BikerLocation } from './biker-location.entity';
import { Biker } from '../bikers/biker.entity';

@Injectable()
export class BikerLocationService {
    private readonly logger = new Logger(BikerLocationService.name);

    constructor(
        @InjectRepository(BikerLocation)
        private bikerLocationRepository: Repository<BikerLocation>,
        @InjectRepository(Biker)
        private bikerRepository: Repository<Biker>,
    ) {}

    /**
     * Update biker's current location (called every 3 seconds from mobile app)
     */
    async updateBikerLocation(
        bikerId: string,
        latitude: number,
        longitude: number,
        heading?: number,
        speed?: number,
        accuracy?: number,
    ): Promise<BikerLocation> {
        try {
            // Find existing location or create new one
            let location = await this.bikerLocationRepository.findOne({
                where: { biker: { id: bikerId as any } },
                relations: ['biker'],
            });

            if (!location) {
                const biker = await this.bikerRepository.findOne({
                    where: { id: bikerId as any },
                });
                if (!biker) {
                    throw new Error(`Biker ${bikerId} not found`);
                }
                location = this.bikerLocationRepository.create({
                    biker,
                    latitude,
                    longitude,
                    heading,
                    speed,
                    accuracy,
                });
            } else {
                location.latitude = latitude;
                location.longitude = longitude;
                if (heading !== undefined) location.heading = heading;
                if (speed !== undefined) location.speed = speed;
                if (accuracy !== undefined) location.accuracy = accuracy;
            }

            return await this.bikerLocationRepository.save(location);
        } catch (error) {
            this.logger.error(`Failed to update biker location: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get nearby bikers within specified radius
     */
    async getNearbyBikers(
        latitude: number,
        longitude: number,
        radiusKm: number = 5,
        limit: number = 20,
    ): Promise<BikerLocation[]> {
        try {
            const query = this.bikerLocationRepository
                .createQueryBuilder('bl')
                .leftJoinAndSelect('bl.biker', 'biker')
                .where(
                    `ST_DWithin(
                    ST_MakePoint(bl.latitude, bl.longitude)::geography,
                    ST_MakePoint(:lat, :lng)::geography,
                    :radius
                )`,
                    {
                        lat: latitude,
                        lng: longitude,
                        radius: radiusKm * 1000, // Convert to meters
                    },
                )
                .andWhere('biker.is_online = true')
                .andWhere('biker.is_available = true')
                .andWhere('biker.status = :status', { status: 'active' })
                .orderBy(
                    `ST_Distance(
                    ST_MakePoint(bl.latitude, bl.longitude)::geography,
                    ST_MakePoint(:lat, :lng)::geography
                )`,
                    'ASC',
                )
                .setParameters({ lat: latitude, lng: longitude })
                .limit(limit);

            return await query.getMany();
        } catch (error) {
            this.logger.error(`Failed to get nearby bikers: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get specific biker's current location
     */
    async getBikerCurrentLocation(bikerId: string): Promise<BikerLocation | null> {
        return await this.bikerLocationRepository.findOne({
            where: { biker: { id: bikerId as any } },
            relations: ['biker'],
        });
    }

    /**
     * Get multiple bikers' current locations
     */
    async getBikersLocations(bikerIds: string[]): Promise<BikerLocation[]> {
        if (!bikerIds || bikerIds.length === 0) {
            return [];
        }
        return await this.bikerLocationRepository
            .createQueryBuilder('bl')
            .whereInIds(bikerIds)
            .leftJoinAndSelect('bl.biker', 'biker')
            .getMany();
    }

    /**
     * Clear old tracking data (older than 7 days)
     */
    async clearOldLocations(daysOld: number = 7): Promise<void> {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);

        await this.bikerLocationRepository.delete({
            updatedAt: {
                getRepository: () => ({
                    createQueryBuilder: (alias: string) =>
                        this.bikerLocationRepository
                            .createQueryBuilder(alias)
                            .where(`${alias}.updated_at < :cutoff`, { cutoff: cutoffDate }),
                }),
            } as any,
        });

        this.logger.log(`Cleared biker locations older than ${daysOld} days`);
    }
}
