import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayConnection,
    OnGatewayDisconnect,
    ConnectedSocket,
    MessageBody,
    OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RealtimeEventsService } from '../realtime/realtime-events.service';

@WebSocketGateway({ cors: true, path: '/ws/tracking' })
export class TrackingGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    constructor(private readonly realtime: RealtimeEventsService) { }

    // ── Wire up the shared RealtimeEventsService so order-flow can emit ──
    afterInit(server: Server) {
        this.realtime.setServer(server);
        console.log('[TrackingGateway] Realtime server attached');
    }

    handleConnection(client: Socket) {
        console.log(`[WS] Client connected: ${client.id}`);
    }

    handleDisconnect(client: Socket) {
        console.log(`[WS] Client disconnected: ${client.id}`);
    }

    /**
     * Called by both customers and bikers when they open the app.
     * Joins the client to their personal room `user:{userId}` so that
     * emitToUser() calls in order-flow reach them.
     */
    @SubscribeMessage('register')
    handleRegister(@MessageBody() data: { userId: string | number; userType: string }, @ConnectedSocket() client: Socket) {
        if (data?.userId) {
            const room = `user:${data.userId}`;
            client.join(room);
            console.log(`[WS] ${data.userType || 'user'} ${data.userId} joined room ${room}`);
        }
    }

    /**
     * Legacy: customer emits 'new_order' → broadcast to all connected drivers.
     * This supplements the backend-driven flow for real-time discovery.
     */
    @SubscribeMessage('new_order')
    handleNewOrder(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
        this.server.emit('new_order_request', data);
    }

    @SubscribeMessage('biker_selected')
    handleBikerSelected(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
        this.server.emit('biker_accepted', data);
    }

    @SubscribeMessage('driver_location')
    handleDriverLocation(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
        this.server.emit('driver_location_update', data);
        if (data?.orderId) {
            this.server.to(`order_${data.orderId}`).emit('tracking_update', data);
        }
    }

    @SubscribeMessage('subscribe')
    handleSubscribe(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
        if (data?.orderId) {
            client.join(`order_${data.orderId}`);
        }
    }
}
