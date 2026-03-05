import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurrentUser } from '../common/current-user.decorator';
import { Roles } from '../common/roles.decorator';
import { UserRole } from '../users/user.entity';
import { ChatMessageEntity } from './chat-message.entity';

@Controller('api/chat')
@Roles(UserRole.CUSTOMER, UserRole.DRIVER, UserRole.ADMIN)
export class ChatController {
    constructor(
        @InjectRepository(ChatMessageEntity)
        private messagesRepo: Repository<ChatMessageEntity>,
    ) { }

    @Get('history')
    async getHistory(
        @CurrentUser() user: any,
        @Query('orderId') orderId?: string,
        @Query('room') room?: string,
    ) {
        const orderIdNum = orderId ? Number(orderId) : 0;

        const qb = this.messagesRepo.createQueryBuilder('msg');
        if (orderIdNum > 0) {
            qb.where('msg.orderId = :orderId', { orderId: orderIdNum });
        } else if (room) {
            qb.where('msg.room = :room', { room });
        } else {
            return { success: true, data: { messages: [] } };
        }

        qb.orderBy('msg.createdAt', 'ASC');
        const messages = await qb.getMany();

        return {
            success: true,
            data: { messages },
        };
    }

    @Post('message')
    async sendMessage(
        @CurrentUser() user: any,
        @Body() body: {
            orderId?: number;
            room?: string;
            text?: string;
            image?: string;
            audio?: string;
            type?: string;
            senderName?: string;
        },
    ) {
        const orderId = body.orderId ? Number(body.orderId) : 0;
        const msg = this.messagesRepo.create({
            orderId: orderId > 0 ? orderId : null,
            room: body.room,
            text: body.text,
            image: body.image,
            audio: body.audio,
            type: body.type || (body.image ? 'image' : body.audio ? 'audio' : 'text'),
            senderId: user.id,
            senderName: body.senderName || user.name || 'User',
            createdAt: new Date(),
        });

        await this.messagesRepo.save(msg);

        return {
            success: true,
            data: { message: msg },
        };
    }
}
