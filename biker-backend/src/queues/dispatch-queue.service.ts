import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';

@Injectable()
export class DispatchQueueService {
    private readonly logger = new Logger(DispatchQueueService.name);
    private readonly queue: Queue | null;

    constructor() {
        const url = process.env.REDIS_URL;
        this.queue = url
            ? new Queue('dispatch', {
                  connection: { url },
                  defaultJobOptions: { removeOnComplete: 1000, removeOnFail: 5000 },
              })
            : null;
    }

    async enqueueDriverPush(payload: { driverId: number; orderId: number; title: string; body: string }) {
        if (!this.queue) {
            this.logger.warn(`REDIS_URL not set; skipping push job for driver ${payload.driverId}`);
            return;
        }
        await this.queue.add('send_driver_push', payload);
    }
}
