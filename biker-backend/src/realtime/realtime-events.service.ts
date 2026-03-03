import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
export class RealtimeEventsService {
    private readonly logger = new Logger(RealtimeEventsService.name);
    private server: Server | null = null;

    setServer(server: Server) {
        this.server = server;
        this.logger.log('Realtime server attached');
    }

    emitToRoom(room: string, event: string, payload: any) {
        if (!this.server) return;
        this.server.to(room).emit(event, payload);
    }

    emitToUser(userId: number, event: string, payload: any) {
        this.emitToRoom(`user:${userId}`, event, payload);
    }

    emitToOrder(orderId: number, event: string, payload: any) {
        this.emitToRoom(`order:${orderId}`, event, payload);
    }

    emitToAll(event: string, payload: any) {
        if (!this.server) return;
        this.server.emit(event, payload);
    }
}
