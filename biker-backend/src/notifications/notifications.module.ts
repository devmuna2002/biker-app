import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './notification.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { ApiNotificationsController } from './api-notifications.controller';

@Module({
    imports: [TypeOrmModule.forFeature([Notification])],
    providers: [NotificationsService],
    controllers: [NotificationsController, ApiNotificationsController],
    exports: [NotificationsService],
})
export class NotificationsModule { }
