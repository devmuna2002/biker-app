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

    // ── Chat: join a chat room ──
    @SubscribeMessage('join_chat')
    handleJoinChat(@MessageBody() data: { room: string; userId: string | number; orderId?: number }, @ConnectedSocket() client: Socket) {
        if (data?.room) {
            client.join(data.room);
            console.log(`[WS] User ${data.userId} joined chat room ${data.room}`);
        }
        // Also auto-join order-scoped chat room if orderId is provided
        if (data?.orderId) {
            const orderRoom = `chat_${data.orderId}`;
            client.join(orderRoom);
        }
    }

    // ── Chat: relay text/image messages to everyone in the room ──
    @SubscribeMessage('chat_message')
    handleChatMessage(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
        const room = data?.room;
        if (!room) return;

        const payload = {
            id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            room,
            orderId: data.orderId,
            text: data.text,
            senderId: data.senderId,
            senderName: data.senderName,
            timestamp: new Date().toISOString(),
        };

        // Broadcast to everyone in the room EXCEPT the sender
        client.to(room).emit('new_message', payload);
        console.log(`[WS Chat] Message in ${room} from ${data.senderName}: ${(data.text || '').substring(0, 50)}`);
    }

    // ── Chat: relay media (images, audio) to everyone in the room ──
    @SubscribeMessage('chat_media')
    handleChatMedia(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
        const room = data?.room;
        if (!room) return;

        const payload = {
            id: `media-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            room,
            orderId: data.orderId,
            type: data.mediaType || 'image', // 'image' or 'audio'
            image: data.mediaType === 'image' ? data.mediaUri : undefined,
            audio: data.mediaType === 'audio' ? data.mediaUri : undefined,
            senderId: data.senderId,
            senderName: data.senderName,
            timestamp: new Date().toISOString(),
        };

        client.to(room).emit('new_message', payload);
        console.log(`[WS Chat] Media (${data.mediaType}) in ${room} from ${data.senderName}`);
    }

    // ── Chat: typing indicator relay ──
    @SubscribeMessage('user_typing')
    handleUserTyping(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
        const room = data?.room;
        if (!room) return;
        client.to(room).emit('user_typing', { senderId: data.senderId });
    }
}
