import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OrdersService } from '../orders/orders.service';
import { SavedLocation } from '../location/saved-location.entity';
import { DriverLocationCacheService } from '../drivers/driver-location-cache.service';
import { BikersService } from '../bikers/bikers.service';
import { ZonesService } from '../zones/zones.service';
import { latLngFromPoint } from '../common/geo';

@Injectable()
export class DashboardService {
    constructor(
        private readonly users: UsersService,
        private readonly notifications: NotificationsService,
        private readonly orders: OrdersService,
        @InjectRepository(SavedLocation) private readonly savedRepo: Repository<SavedLocation>,
        private readonly driverCache: DriverLocationCacheService,
        private readonly bikers: BikersService,
        private readonly zones: ZonesService,
    ) { }

    async init(userId: number, input: { lat: number; lng: number; radiusKm: number }) {
        let user = null;
        let unreadCount = 0;
        let activeOrders = [];
        let stats = { totalOrders: 0, completedOrders: 0, cancelledOrders: 0, totalEarningsCents: 0 };

        if (userId > 0) {
            user = await this.users.findOneById(userId);
            unreadCount = await this.notifications.countUnreadForUser(userId);

            if (user?.role === 'driver') {
                activeOrders = await this.orders.findActiveForUser(userId);
                const history = await this.orders.findHistoryForUser(userId, 100);
                stats = {
                    totalOrders: history.length,
                    completedOrders: history.filter(o => o.status === 'completed').length,
                    cancelledOrders: history.filter(o => o.status === 'cancelled').length,
                    totalEarningsCents: history
                        .filter(o => o.status === 'completed')
                        .reduce((sum, o) => sum + (o.finalPriceCents ?? o.suggestedPriceCents ?? 0), 0),
                };
            } else {
                activeOrders = await this.orders.findActiveForUser(userId);
            }
        }

        const recent = userId > 0 ? await this.savedRepo.find({
            where: { user: { id: userId } } as any,
            order: { createdAt: 'DESC' },
            take: 10,
        }) : [];

        let recentDestinations = recent.map((r) => ({
            id: r.id,
            label: r.label,
            address: r.address,
            lat: r.lat,
            lng: r.lng,
        }));

        if (recentDestinations.length === 0 && userId > 0) {
            const completed = await this.orders.findLastCompletedForUser(userId, 10);
            recentDestinations = completed
                .map((o: any) => {
                    const coords = latLngFromPoint(o.dropoffLocation);
                    if (!coords) return null;
                    return {
                        id: String(o.id),
                        label: o.dropoffAddress || 'Recent destination',
                        address: o.dropoffAddress,
                        lat: coords.lat,
                        lng: coords.lng,
                    };
                })
                .filter(Boolean) as any;
        }

        const zone = await this.zones.findZone(input.lat, input.lng);
        const enabledServices = zone?.enabledServices || [];
        const availability = {
            zone: zone ? { id: zone.id, code: zone.code, name: zone.name } : null,
            enabledServices,
            isAvailable: enabledServices.length > 0 || !zone,
        };

        const cachedNearby = await this.driverCache.nearby(input.lat, input.lng, input.radiusKm, 30);
        const driverRows = await this.bikers.findAvailableByIds(cachedNearby.map((c) => c.driverId));
        const byId = new Map(driverRows.map((d) => [d.id, d]));
        const locs = await Promise.all(cachedNearby.map((c) => this.driverCache.get(c.driverId)));
        const nearbyDrivers = cachedNearby
            .map((c, idx) => {
                const d = byId.get(c.driverId);
                if (!d) return null;
                const loc = locs[idx];
                if (!loc) return null; // Only show drivers with a fresh live-location cache entry
                const coords = { lat: loc.lat, lng: loc.lng };
                return {
                    id: d.id,
                    name: d.user?.name,
                    vehicleType: d.vehicleType,
                    distanceKm: c.distanceKm,
                    coords,
                };
            })
            .filter(Boolean);

        // Persist last known user location best-effort (only if user exists).
        if (userId > 0) {
            await this.users.updateLastKnownLocation(userId, input.lat, input.lng);
        }

        return {
            success: true,
            data: {
                user: user ? {
                    id: user.id,
                    name: user.name,
                    email: user.contactEmail || '',
                    role: user.role,
                    phone: user.phone,
                    city: user.city,
                    country: user.country,
                    countryCode: user.countryCode,
                    rating: user.rating,
                    photo: user.photo,
                    serviceArea: user.serviceAreaCenter
                        ? { ...(latLngFromPoint(user.serviceAreaCenter) as any), radiusKm: user.serviceAreaRadiusKm }
                        : null,
                } : null,
                notifications: { unreadCount },
                stats,
                wallet: user ? {
                    balanceCents: user.walletBalanceCents,
                    currency: user.walletCurrency,
                } : { balanceCents: 0, currency: 'USD' },
                activeDeliveries: activeOrders.map((o: any) => ({
                    id: o.id,
                    status: o.status,
                    serviceType: o.serviceType,
                    priceCents: o.finalPriceCents ?? o.suggestedPriceCents,
                    pickup: {
                        address: o.pickupAddress,
                        coords: latLngFromPoint(o.pickupLocation),
                    },
                    dropoff: {
                        address: o.dropoffAddress,
                        coords: latLngFromPoint(o.dropoffLocation),
                    },
                    etaMinutes: o.etaMinutes,
                    distanceKm: o.distanceKm,
                    driver: o.biker
                        ? {
                            id: o.biker.id,
                            name: o.biker.user?.name,
                            vehicleType: o.biker.vehicleType,
                        }
                        : null,
                    createdAt: o.createdAt,
                })),
                recentDestinations,
                location: {
                    lat: input.lat,
                    lng: input.lng,
                },
                nearbyDrivers,
                serviceAvailability: availability,
                ws: {
                    path: '/ws/tracking',
                },
            },
        };
    }
}
