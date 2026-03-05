import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatController } from './chat.controller';
import { ChatMessageEntity } from './chat-message.entity';

@Module({
    imports: [TypeOrmModule.forFeature([ChatMessageEntity])],
    controllers: [ChatController],
})
export class ChatModule { }
