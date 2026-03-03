import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TrackingSession } from './tracking-session.entity';
import { TrackingLog } from './tracking-log.entity';
import { TrackingQueueService } from '../queues/tracking-queue.service';

@Injectable()
export class TrackingService {
    constructor(
        @InjectRepository(TrackingSession) private readonly sessionsRepo: Repository<TrackingSession>,
        @InjectRepository(TrackingLog) private readonly logsRepo: Repository<TrackingLog>,
        private readonly queue: TrackingQueueService,
    ) {}

    async getSessionForOrder(orderId: number) {
        return this.sessionsRepo.findOne({ where: { order: { id: orderId } } as any });
    }

    async persistLog(payload: {
        sessionId: string;
        bikerId: number | null;
        lat: number;
        lng: number;
        speedMps?: number;
        headingDeg?: number;
        accuracyM?: number;
        recordedAt: Date;
        isSuspectedSpoof: boolean;
    }) {
        if (process.env.REDIS_URL) {
            await this.queue.enqueueTrackingLog(payload);
            return;
        }

        // No queue configured: save inline.
        const session = await this.sessionsRepo.findOne({ where: { id: payload.sessionId } });
        if (!session) return;
        const log = this.logsRepo.create({
            session,
            biker: payload.bikerId ? ({ id: payload.bikerId } as any) : null,
            lat: payload.lat,
            lng: payload.lng,
            speedMps: payload.speedMps ?? null,
            headingDeg: payload.headingDeg ?? null,
            accuracyM: payload.accuracyM ?? null,
            recordedAt: payload.recordedAt,
            isSuspectedSpoof: payload.isSuspectedSpoof,
        });
        await this.logsRepo.save(log);
    }
}
