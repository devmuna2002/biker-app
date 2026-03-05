import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Biker } from '../bikers/biker.entity';
import { Order, OrderStatus } from '../orders/order.entity';
import { pointFromLatLng } from '../common/geo';
import { TrackingSession, TrackingSessionStatus } from '../tracking/tracking-session.entity';
import { RealtimeEventsService } from '../realtime/realtime-events.service';
import { BikerLocation } from '../tracking/biker-location.entity';
import { TrackingService } from '../tracking/tracking.service';
import { DriverLocationCacheService } from '../drivers/driver-location-cache.service';


@Injectable()
export class DriverService {
    constructor(
        @InjectRepository(Biker) private readonly bikersRepo: Repository<Biker>,
        @InjectRepository(Order) private readonly ordersRepo: Repository<Order>,
        @InjectRepository(TrackingSession) private readonly sessionsRepo: Repository<TrackingSession>,
        @InjectRepository(BikerLocation) private readonly bikerLocationRepo: Repository<BikerLocation>,
        private readonly realtime: RealtimeEventsService,
        private readonly trackingService: TrackingService,
        private readonly cache: DriverLocationCacheService,
    ) { }

    async getBikerForUser(userId: number) {
        const biker = await this.bikersRepo.findOne({ where: { user: { id: userId } } as any, relations: ['user'] });
        if (!biker) throw new NotFoundException('Driver profile not found');
        return biker;
    }

    async setOnline(userId: number, online: boolean) {
        let biker: Biker | null = null;
        try {
            biker = await this.getBikerForUser(userId);
        } catch (e) {
            // No biker profile — return a friendly 200 with isOnline=false rather than crashing.
            // The front-end will see success:false and show the subscribe/register prompt.
            return {
                success: false,
                message: 'No driver profile found for this account. Please ensure you are registered as a biker.',
                data: { isOnline: false, isAvailable: false },
            };
        }

        biker.isOnline = online;

        const now = new Date();
        const hasActiveSubscription = biker.subscriptionStatus === 'active' &&
            (!biker.subscriptionExpiryDate || biker.subscriptionExpiryDate >= now);

        const hasActiveTrial = biker.trialExpiryDate && biker.trialExpiryDate >= now;

        if (!online) {
            biker.isAvailable = false;
            // Immediate removal from live cache
            await this.cache.remove(biker.id);
        } else {
            // Check verification status first
            if (biker.verificationStatus !== 'approved') {
                biker.isOnline = false;
                biker.isAvailable = false;
                await this.bikersRepo.save(biker);
                const msg = biker.verificationStatus === 'rejected'
                    ? 'Your account verification was rejected. Please contact support.'
                    : 'Your account is pending approval. Please wait for an administrator to verify your profile photo.';
                return {
                    success: false,
                    message: msg,
                    data: { isOnline: false, isAvailable: false },
                };
            }

            // Allow going online — availability simply means they can see and be assigned orders.
            // Eligibility to accept them is checked at the moment of acceptance.
            const active = await this.findActiveOrderForBiker(biker.id);
            biker.isAvailable = !active;

            if (!hasActiveSubscription && !hasActiveTrial) {
                // They can go online but will be in restricted mode
                await this.bikersRepo.save(biker);
                return {
                    success: true,
                    message: 'Your free trial has expired. You can see incoming requests but cannot accept them until you subscribe.',
                    data: { isOnline: biker.isOnline, isAvailable: biker.isAvailable },
                };
            }
        }

        await this.bikersRepo.save(biker);
        return { success: true, data: { isOnline: biker.isOnline, isAvailable: biker.isAvailable } };
    }

    async updateLocation(userId: number, lat: number, lng: number) {
        const biker = await this.getBikerForUser(userId);
        biker.lastKnownLocation = pointFromLatLng(lat, lng) as any;
        await this.bikersRepo.save(biker);

        // also persist location record for live tracking
        try {
            let loc = await this.bikerLocationRepo.findOne({ where: { biker: { id: biker.id } as any } });
            if (!loc) {
                loc = this.bikerLocationRepo.create({
                    biker,
                    latitude: lat,
                    longitude: lng,
                    location: pointFromLatLng(lat, lng) as any,
                });
            } else {
                loc.latitude = lat;
                loc.longitude = lng;
                loc.location = pointFromLatLng(lat, lng) as any;
            }
            await this.bikerLocationRepo.save(loc);
        } catch (e) {
            // non-fatal, log for debugging
            console.error('[DriverService] failed to persist biker location', e?.message || e);
        }

        // if there is an active tracking session for any order assigned to this biker,
        // create a tracking log entry via the tracking service
        try {
            const activeSession = await this.sessionsRepo.findOne({
                where: { order: { biker: { id: biker.id } } as any, status: TrackingSessionStatus.ACTIVE } as any,
                relations: ['order', 'order.biker'],
            });
            if (activeSession) {
                await this.trackingService.persistLog({
                    sessionId: activeSession.id,
                    bikerId: biker.id as any,
                    lat,
                    lng,
                    recordedAt: new Date(),
                    isSuspectedSpoof: false,
                });
            }
        } catch (e) {
            // log error but do not block location update
            console.error('[DriverService] error writing tracking log', e?.message || e);
        }

        return { success: true };
    }

    async findActiveOrder(userId: number) {
        let biker;
        try {
            biker = await this.getBikerForUser(userId);
        } catch {
            return null;
        }
        return this.findActiveOrderForBiker(biker.id);
    }

    async findActiveOrderForBiker(bikerId: number) {
        const order = await this.ordersRepo.findOne({
            where: {
                biker: { id: bikerId } as any,
                status: In([OrderStatus.ASSIGNED, OrderStatus.PICKED_UP, OrderStatus.IN_TRANSIT]),
            },
            relations: ['user', 'biker', 'biker.user'],
            order: { createdAt: 'DESC' },
        });
        return order || null;
    }

    async updateOrderStatus(userId: number, orderId: number, next: OrderStatus) {
        const biker = await this.getBikerForUser(userId);
        const order = await this.ordersRepo.findOne({ where: { id: orderId } as any, relations: ['biker', 'biker.user', 'user'] });
        if (!order) throw new NotFoundException('Order not found');
        if (!order.biker || order.biker.id !== biker.id) throw new BadRequestException('Not assigned to this order');

        const allowed = new Set([OrderStatus.PICKED_UP, OrderStatus.IN_TRANSIT, OrderStatus.COMPLETED]);
        if (!allowed.has(next)) throw new BadRequestException('Invalid status transition');

        order.status = next;
        await this.ordersRepo.save(order);

        // Realtime status update to subscribed clients.
        this.realtime.emitToOrder(order.id, 'order_status', {
            orderId: order.id,
            status: order.status,
            updatedAt: new Date().toISOString(),
        });
        if ((order as any).user?.id) {
            this.realtime.emitToUser((order as any).user.id, 'order_status', {
                orderId: order.id,
                status: order.status,
                updatedAt: new Date().toISOString(),
            });
        }

        if (next === OrderStatus.COMPLETED) {
            biker.isAvailable = biker.isOnline;
            await this.bikersRepo.save(biker);

            const session = await this.sessionsRepo.findOne({ where: { order: { id: order.id } } as any });
            if (session) {
                session.status = TrackingSessionStatus.ENDED;
                session.endedAt = new Date();
                await this.sessionsRepo.save(session);
            }

            // Save notification for customer
            if ((order as any).user?.id) {
                try {
                    await this.ordersRepo.manager.insert('notifications', {
                        userId: (order as any).user.id,
                        type: 'delivery',
                        message: `Your booking #${order.id} has been completed!`,
                        isRead: false,
                        createdAt: new Date(),
                    });
                } catch (e) {
                    // Ignore if it fails
                }
            }

            // Notify driver + customer.
            this.realtime.emitToUser(userId, 'order_completed', {
                orderId: order.id,
                status: order.status,
            });
            if ((order as any).user?.id) {
                this.realtime.emitToUser((order as any).user.id, 'order_completed', {
                    orderId: order.id,
                    status: order.status,
                });
            }
        }

        return { success: true, data: { orderId: order.id, status: order.status } };
    }

    async acceptOrder(userId: number, orderId: number) {
        const biker = await this.getBikerForUser(userId);

        // subscription & trial enforcement
        const now = new Date();
        const hasActiveSubscription = biker.subscriptionStatus === 'active' &&
            (!biker.subscriptionExpiryDate || biker.subscriptionExpiryDate >= now);
        const hasActiveTrial = biker.trialExpiryDate && biker.trialExpiryDate >= now;

        const order = await this.ordersRepo.findOne({
            where: { id: orderId } as any,
            relations: ['user', 'biker']
        });

        if (!order) throw new NotFoundException('Order not found');

        // If specifically assigned to THEM, we allow them to accept even if trial is expired
        // to avoid deadlocking the booking flow they are already part of.
        const isAssignedToThem = order.biker && order.biker.id === biker.id;

        if (!hasActiveSubscription && !hasActiveTrial && !isAssignedToThem) {
            throw new BadRequestException('Cannot accept orders: Your free trial has expired. Please subscribe to continue.');
        }

        // If it's already assigned to someone else
        if (order.biker && order.biker.id !== biker.id) {
            throw new BadRequestException('Order already assigned to another driver');
        }

        // If it's already assigned to THEM, we just treat it as a confirmation/re-acceptance
        if (order.biker && order.biker.id === biker.id) {
            // Already assigned to them, just ensure it's in the right status or just return success
            if (order.status === OrderStatus.DRAFT) {
                order.status = OrderStatus.ASSIGNED;
                await this.ordersRepo.save(order);
            }
        } else {
            // Not assigned to anybody yet
            if (!biker.isOnline || !biker.isAvailable) {
                throw new BadRequestException('You must be online and available to accept orders');
            }
            order.biker = biker;
            order.status = OrderStatus.ASSIGNED;
            await this.ordersRepo.save(order);
        }

        // create tracking session for live ride tracking if not already exists
        try {
            const existingSession = await this.sessionsRepo.findOne({ where: { order: { id: order.id } } as any });
            if (!existingSession) {
                const session = this.sessionsRepo.create({
                    order: order as any,
                    status: TrackingSessionStatus.ACTIVE,
                    startedAt: new Date(),
                });
                await this.sessionsRepo.save(session);
            }

            // Ensure availability is set to false since they are now on an order
            if (biker.isAvailable) {
                biker.isAvailable = false;
                await this.bikersRepo.save(biker);
            }
        } catch (e) {
            console.error('[DriverService] failed to manage tracking session or availability', e?.message || e);
        }

        this.realtime.emitToOrder(order.id, 'order_accepted', {
            orderId: order.id,
            bikerId: biker.id,
            bikerName: biker.user?.name,
        });

        if ((order as any).user?.id) {
            this.realtime.emitToUser((order as any).user.id, 'order_accepted', {
                orderId: order.id,
                bikerId: biker.id,
                bikerName: biker.user?.name,
            });
        }

        const fullOrder = await this.ordersRepo.findOne({
            where: { id: order.id } as any,
            relations: ['user', 'biker', 'biker.user']
        });
        return { success: true, data: { order: fullOrder, orderId: order.id, status: order.status } };
    }
}
