import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayConnection,
    OnGatewayDisconnect,
    MessageBody,
    ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: true })
export class NegotiationGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    handleConnection(client: Socket) {
        console.log(`Client connected: ${client.id}`);
    }

    handleDisconnect(client: Socket) {
        console.log(`Client disconnected: ${client.id}`);
    }

    @SubscribeMessage('createOrder')
    handleCreateOrder(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
        // 1. Save order to DB (Order entity)
        // 2. Broadcast to all nearby bikers within radius (Geofencing logic)
        console.log('Order created, broadcasting to nearby bikers...', data);
        this.server.emit('newOrder', data);
    }

    @SubscribeMessage('bikerResponse')
    handleBikerResponse(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
        // data: { orderId: string, bikerId: string, action: 'accept' | 'decline' | 'counter', price?: number }
        console.log(`Biker ${data.bikerId} responded with ${data.action} to order ${data.orderId}`);

        if (data.action === 'accept') {
            this.server.emit(`orderStatusUpdate:${data.orderId}`, { status: 'assigned', bikerId: data.bikerId });
        } else if (data.action === 'counter') {
            this.server.emit(`newCounterOffer:${data.orderId}`, { bikerId: data.bikerId, price: data.price });
        }
    }

    @SubscribeMessage('userAcceptOffer')
    handleUserAcceptOffer(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
        // data: { orderId: string, bikerId: string }
        console.log(`User accepted offer from biker ${data.bikerId} for order ${data.orderId}`);
        this.server.emit(`orderFinalized:${data.orderId}`, { bikerId: data.bikerId, status: 'assigned' });
    }
}
