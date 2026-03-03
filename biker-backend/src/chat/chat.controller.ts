import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { Roles } from '../common/roles.decorator';
import { UserRole } from '../users/user.entity';

interface ChatMessage {
    id: string;
    orderId: number;
    text: string;
    senderId: number;
    senderName: string;
    createdAt: Date;
}

const chatMessages: Map<number, ChatMessage[]> = new Map();

@Controller('api/chat')
@Roles(UserRole.CUSTOMER, UserRole.DRIVER, UserRole.ADMIN)
export class ChatController {
    @Get('history')
    async getHistory(@CurrentUser() user: any, @Param('orderId') orderId?: string) {
        const orderIdNum = orderId ? Number(orderId) : undefined;
        const allMessages = Array.from(chatMessages.values()).flat();
        
        let messages = allMessages;
        if (orderIdNum) {
            messages = allMessages.filter(m => m.orderId === orderIdNum);
        }
        
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
        @Body() body: { orderId?: number; text: string; senderName?: string },
    ) {
        const orderId = body.orderId ? Number(body.orderId) : 0;
        
        const message: ChatMessage = {
            id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            orderId,
            text: body.text,
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
