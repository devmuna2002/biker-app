import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

@Injectable()
export class TrackingQueueService {
    private readonly queue: Queue | null;

    constructor() {
        const url = process.env.REDIS_URL;
        this.queue = url
            ? new Queue('tracking', {
                  connection: { url },
                  defaultJobOptions: { removeOnComplete: 5000, removeOnFail: 10000 },
              })
            : null;
    }

    async enqueueTrackingLog(payload: any) {
        if (!this.queue) return;
        await this.queue.add('persist_tracking_log', payload);
    }
}
