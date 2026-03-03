import { Body, Controller, Get, Patch, Param, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../common/roles.decorator';
import { UserRole } from '../users/user.entity';
import { CurrentUser } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DriverService } from './driver.service';
import { SetOnlineDto } from './dto/set-online.dto';
import { UpdateDriverLocationDto } from './dto/update-location.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { DriverLocationCacheService } from '../drivers/driver-location-cache.service';
import { latLngFromPoint } from '../common/geo';

@UseGuards(JwtAuthGuard)
@Controller('api/driver')
@Roles(UserRole.DRIVER, UserRole.ADMIN)
export class DriverController {
    constructor(
        private readonly driver: DriverService,
        private readonly cache: DriverLocationCacheService,
    ) { }

    @Get('me')
    async me(@CurrentUser() user: any) {
        const biker = await this.driver.getBikerForUser(user.id);
        const coords = latLngFromPoint(biker.lastKnownLocation);
        return {
            success: true,
            data: {
                id: biker.id,
                isOnline: biker.isOnline,
                isAvailable: biker.isAvailable,
                vehicleType: biker.vehicleType,
                lastKnown: coords ? { ...coords } : null,
                user: {
                    id: biker.user?.id,
                    name: biker.user?.name,
                    email: biker.user?.email,
                },
                subscriptionStatus: biker.subscriptionStatus,
                subscriptionExpiryDate: biker.subscriptionExpiryDate,
            },
        };
    }

    @Patch('online')
    setOnline(@CurrentUser() user: any, @Body() dto: SetOnlineDto) {
        return this.driver.setOnline(user.id, dto.online);
    }

    @Patch('location')
    async updateLocation(@CurrentUser() user: any, @Body() dto: UpdateDriverLocationDto) {
        const res = await this.driver.updateLocation(user.id, dto.lat, dto.lng);
        const biker = await this.driver.getBikerForUser(user.id);
        await this.cache.set(biker.id, {
            lat: dto.lat,
            lng: dto.lng,
            speedMps: dto.speedMps,
            headingDeg: dto.headingDeg,
            accuracyM: dto.accuracyM,
            ts: Date.now(),
        });
        return res;
    }

    @Get('active-order')
    async activeOrder(@CurrentUser() user: any) {
        const order = await this.driver.findActiveOrder(user.id);
        if (!order) return { success: true, data: { order: null } };
        return {
            success: true,
            data: {
                order: {
                    id: order.id,
                    status: order.status,
                    serviceType: order.serviceType,
                    pickup: { address: order.pickupAddress, coords: latLngFromPoint(order.pickupLocation) },
                    dropoff: { address: order.dropoffAddress, coords: latLngFromPoint(order.dropoffLocation) },
                    priceCents: order.finalPriceCents ?? order.suggestedPriceCents,
                    distanceKm: order.distanceKm,
                    etaMinutes: order.etaMinutes,
                    customerName: order.user?.name,
                    customerPhone: order.user?.phone,
                    customerId: order.user?.id,
                    notes: (order as any).notes,
                    itemDescription: (order as any).itemDescription,
                },
            },
        };
    }

    @Patch('orders/:orderId/status')
    updateStatus(@CurrentUser() user: any, @Param('orderId') orderId: string, @Body() dto: UpdateOrderStatusDto) {
        return this.driver.updateOrderStatus(user.id, Number(orderId), dto.status);
    }

    @Post('orders/:orderId/accept')
    acceptOrder(@CurrentUser() user: any, @Param('orderId') orderId: string) {
        return this.driver.acceptOrder(user.id, Number(orderId));
    }
}
