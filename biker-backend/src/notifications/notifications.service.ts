import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './notification.entity';
import { User } from '../users/user.entity';

@Injectable()
export class NotificationsService {
    constructor(
        @InjectRepository(Notification)
        private notificationsRepository: Repository<Notification>,
    ) { }

    async create(user: User, type: string, message: string) {
        const notification = this.notificationsRepository.create({
            user,
            type,
            message,
        });
        return this.notificationsRepository.save(notification);
    }

    async findAllForUser(userId: number) {
        return this.notificationsRepository.find({
            where: { user: { id: userId } },
            order: { createdAt: 'DESC' },
        });
    }

    async markAsRead(id: number) {
        await this.notificationsRepository.update(id, { isRead: true });
        return { success: true };
    }

    async countUnreadForUser(userId: number) {
        return this.notificationsRepository.count({ where: { user: { id: userId }, isRead: false } });
    }
}
