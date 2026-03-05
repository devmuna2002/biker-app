import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('chat_messages')
export class ChatMessageEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ nullable: true })
    orderId: number;

    @Column({ nullable: true })
    room: string;

    @Column({ type: 'text', nullable: true })
    text: string;

    @Column({ nullable: true })
    image: string;

    @Column({ nullable: true })
    audio: string;

    @Column({ default: 'text' })
    type: string; // 'text' | 'image' | 'audio'

    @Column()
    senderId: number;

    @Column()
    senderName: string;

    @CreateDateColumn()
    createdAt: Date;
}
