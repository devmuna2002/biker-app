import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Worker } from 'bullmq';
import { AppModule } from './app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TrackingLog } from './tracking/tracking-log.entity';
import { TrackingSession } from './tracking/tracking-session.entity';

async function bootstrap() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
        // eslint-disable-next-line no-console
        console.error('REDIS_URL is required to run workers');
        process.exit(1);
    }

    const app = await NestFactory.createApplicationContext(AppModule, { logger: ['log', 'warn', 'error'] });
    const logsRepo = app.get<Repository<TrackingLog>>(getRepositoryToken(TrackingLog));
    const sessionsRepo = app.get<Repository<TrackingSession>>(getRepositoryToken(TrackingSession));

    // Persist tracking logs asynchronously.
    // Payload shape matches TrackingService.persistLog enqueue payload.
    new Worker(
        'tracking',
        async (job) => {
            const p = job.data;
            const session = await sessionsRepo.findOne({ where: { id: p.sessionId } as any });
            if (!session) return;
            const log = logsRepo.create({
                session,
                biker: p.bikerId ? ({ id: p.bikerId } as any) : null,
                lat: Number(p.lat),
                lng: Number(p.lng),
                speedMps: p.speedMps ?? null,
                headingDeg: p.headingDeg ?? null,
                accuracyM: p.accuracyM ?? null,
                recordedAt: new Date(p.recordedAt),
                isSuspectedSpoof: Boolean(p.isSuspectedSpoof),
            });
            await logsRepo.save(log);
        },
        { connection: { url: redisUrl } },
    );

    // Dispatch notifications (push integration stub).
    new Worker(
        'dispatch',
        async (job) => {
            // eslint-disable-next-line no-console
            console.log(`[dispatch] ${job.name}`, job.data);
        },
        { connection: { url: redisUrl } },
    );

    // eslint-disable-next-line no-console
    console.log('Workers started');
}

bootstrap();
