import { Module } from '@nestjs/common';
import { DispatchQueueService } from './dispatch-queue.service';
import { TrackingQueueService } from './tracking-queue.service';

@Module({
    providers: [DispatchQueueService, TrackingQueueService],
    exports: [DispatchQueueService, TrackingQueueService],
})
export class QueuesModule {}
