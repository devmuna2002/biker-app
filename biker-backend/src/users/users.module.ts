import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { Biker } from '../bikers/biker.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { ApiUsersController } from './api-users.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
    imports: [TypeOrmModule.forFeature([User, Biker]), NotificationsModule],
    providers: [UsersService],
    controllers: [UsersController, ApiUsersController],
    exports: [UsersService],
})
export class UsersModule { }
