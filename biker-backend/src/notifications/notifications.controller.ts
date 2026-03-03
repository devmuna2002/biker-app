import { Controller, Get, Param, Patch, ForbiddenException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../common/current-user.decorator';
import { Roles } from '../common/roles.decorator';
import { UserRole } from '../users/user.entity';

@Controller('notifications')
@Roles(UserRole.CUSTOMER, UserRole.DRIVER, UserRole.ADMIN)
export class NotificationsController {
    constructor(private readonly notificationsService: NotificationsService) { }

    @Get('user/:userId')
    async findAll(@CurrentUser() user: any, @Param('userId') userId: string) {
        if (Number(userId) !== Number(user.id)) throw new ForbiddenException('Forbidden');
        return this.notificationsService.findAllForUser(+userId);
    }

    @Patch(':id/read')
    markAsRead(@Param('id') id: string) {
        return this.notificationsService.markAsRead(+id);
    }
}
