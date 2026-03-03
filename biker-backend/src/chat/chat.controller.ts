import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { Roles } from '../common/roles.decorator';
import { UserRole } from '../users/user.entity';

interface ChatMessage {
    id: string;
    orderId: number;
    text?: string;
    image?: string;
    audio?: string;
    type?: string; // 'text' | 'image' | 'audio'
    senderId: number;
    senderName: string;
    createdAt: Date;
}

const chatMessages: Map<number, ChatMessage[]> = new Map();

@Controller('api/chat')
@Roles(UserRole.CUSTOMER, UserRole.DRIVER, UserRole.ADMIN)
export class ChatController {
    @Get('history')
    async getHistory(
        @CurrentUser() user: any,
        @Query('orderId') orderId?: string,
        @Query('room') room?: string,
    ) {
        const orderIdNum = orderId ? Number(orderId) : 0;
        const messages = chatMessages.get(orderIdNum) || [];

        return {
            success: true,
            data: {
                messages: messages.sort((a, b) =>
                    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                ),
            },
        };
    }

    @Post('message')
    async sendMessage(
        @CurrentUser() user: any,
        @Body() body: {
            orderId?: number;
            text?: string;
            image?: string;
            audio?: string;
            type?: string;
            senderName?: string;
        },
    ) {
        const orderId = body.orderId ? Number(body.orderId) : 0;

        const message: ChatMessage = {
            id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            orderId,
            text: body.text || undefined,
            image: body.image || undefined,
            audio: body.audio || undefined,
            type: body.type || (body.image ? 'image' : body.audio ? 'audio' : 'text'),
            senderId: user.id,
            senderName: body.senderName || user.name || 'User',
            createdAt: new Date(),
        };

        if (!chatMessages.has(orderId)) {
            chatMessages.set(orderId, []);
        }
        chatMessages.get(orderId)!.push(message);

        return {
            success: true,
            data: { message },
        };
    }
}
