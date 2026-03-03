import { Controller, Get, Patch, Param, ForbiddenException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../common/current-user.decorator';
import { Roles } from '../common/roles.decorator';
import { UserRole } from '../users/user.entity';

@Controller('api/notifications')
@Roles(UserRole.CUSTOMER, UserRole.DRIVER, UserRole.ADMIN)
export class ApiNotificationsController {
    constructor(private readonly notifications: NotificationsService) {}

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
}
