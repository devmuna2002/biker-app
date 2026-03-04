import { Controller, Get, Post, Patch, Param, Body, ForbiddenException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../common/current-user.decorator';
import { Roles } from '../common/roles.decorator';
import { UserRole } from '../users/user.entity';
import { Public } from '../common/public.decorator';

@Controller('api/notifications')
@Roles(UserRole.CUSTOMER, UserRole.DRIVER, UserRole.ADMIN)
export class ApiNotificationsController {
    constructor(private readonly notifications: NotificationsService) { }

    @Get()
    async list(@CurrentUser() user: any) {
        const items = await this.notifications.findAllForUser(user.id);
        return {
            success: true,
            data: {
                notifications: (items || []).slice(0, 50).map((n: any) => ({
                    id: n.id,
                    type: n.type,
                    message: n.message,
                    isRead: n.isRead,
                    createdAt: n.createdAt,
                })),
            },
        };
    }

    @Patch(':id/read')
    async markRead(@CurrentUser() user: any, @Param('id') id: string) {
        // Ownership check
        const all = await this.notifications.findAllForUser(user.id);
        const match = (all || []).find((n: any) => String(n.id) === String(id));
        if (!match) throw new ForbiddenException('Forbidden');
        return this.notifications.markAsRead(Number(id));
    }

    // Also support POST for compatibility
    @Post(':id/read')
    async markReadPost(@CurrentUser() user: any, @Param('id') id: string) {
        return this.markRead(user, id);
    }

    @Post('send')
    async sendNotification(@Body() body: { userId: number; title: string; body: string }) {
        try {
            await this.notifications.create(
                { id: body.userId } as any,
                body.title || 'notification',
                body.body || '',
            );
            return { success: true, message: 'Notification sent' };
        } catch (e) {
            return { success: false, message: 'Failed to send notification' };
        }
    }
}
