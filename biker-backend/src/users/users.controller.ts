import { Controller, Get, Post, Body, Param, Patch, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './user.entity';
import { CurrentUser } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { UpdateMeDto } from './dto/update-me.dto';

@Controller('api/users')
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Get()
    findAll() {
        return this.usersService.findAll();
    }

    @Patch('me')
    @UseGuards(JwtAuthGuard)
    async updateMe(@CurrentUser() user: any, @Body() body: UpdateMeDto) {
        const updated = await this.usersService.updateMe(user.id, body);
        return { success: true, data: { user: updated } };
    }

    @Patch(':id')
    update(@Param('id') id: number, @Body() user: Partial<User>) {
        return this.usersService.update(Number(id), user);
    }

    @Post('verify-otp')
    verifyOTP(@Body() body: { phone: string, code: string }) {
        return this.usersService.verifyOTP(body.phone, body.code);
    }
}
