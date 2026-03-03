import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { latLngFromPoint } from '../common/geo';
import { UsersService } from './users.service';
import { UpdateMeDto } from './dto/update-me.dto';

@UseGuards(JwtAuthGuard)
@Controller('api/users')
export class ApiUsersController {
    constructor(private readonly users: UsersService) { }

    @Get('me')
    async me(@CurrentUser() user: any) {
        const u = await this.users.findOneById(user.id);
        return { success: true, data: { user: this.sanitize(u) } };
    }

    @Patch('me')
    async updateMe(@CurrentUser() user: any, @Body() dto: UpdateMeDto) {
        const updated = await this.users.updateMe(user.id, dto);
        return { success: true, data: { user: this.sanitize(updated) } };
    }

    private sanitize(u: any) {
        if (!u) return null;
        const serviceAreaCenter = latLngFromPoint(u.serviceAreaCenter);
        const biker = u.biker || null;

        return {
            id: u.id,
            name: u.name,
            email: u.contactEmail || '',
            phone: u.phone,
            role: u.role,
            city: u.city,
            country: u.country,
            countryCode: u.countryCode,
            photo: u.photo,
            serviceArea: serviceAreaCenter ? { ...serviceAreaCenter, radiusKm: u.serviceAreaRadiusKm } : null,
            wallet: { balanceCents: u.walletBalanceCents, currency: u.walletCurrency },
            licenseVerificationPhoto: biker?.licenseVerificationPhoto || null,
            verificationStatus: biker?.verificationStatus || 'pending',
            trialExpiryDate: biker?.trialExpiryDate || null,
        };
    }
}
