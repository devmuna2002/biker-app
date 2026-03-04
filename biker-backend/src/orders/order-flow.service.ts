import {
    BadRequestException,
    Injectable,
    NotFoundException,
    ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Order, OrderStatus, ServiceType } from './order.entity';
import { UpsertDraftDto } from './dto/upsert-draft.dto';
import { pointFromLatLng } from '../common/geo';
import { User } from '../users/user.entity';
import { Biker } from '../bikers/biker.entity';
import { DriverAssignment, DriverAssignmentStatus } from './driver-assignment.entity';
import { Payment, PaymentMethod, PaymentStatus } from '../payments/payment.entity';
import { TrackingSession, TrackingSessionStatus } from '../tracking/tracking-session.entity';
import { DriverLocationCacheService } from '../drivers/driver-location-cache.service';
import { ZonesService } from '../zones/zones.service';
import { DispatchQueueService } from '../queues/dispatch-queue.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { SavedLocation } from '../location/saved-location.entity';
import { RealtimeEventsService } from '../realtime/realtime-events.service';

@Injectable()
export class OrderFlowService {
    constructor(
        private readonly dataSource: DataSource,
        @InjectRepository(Order) private readonly ordersRepo: Repository<Order>,
        @InjectRepository(User) private readonly usersRepo: Repository<User>,
        @InjectRepository(Biker) private readonly bikersRepo: Repository<Biker>,
        @InjectRepository(DriverAssignment) private readonly assignmentsRepo: Repository<DriverAssignment>,
        @InjectRepository(Payment) private readonly paymentsRepo: Repository<Payment>,
        @InjectRepository(TrackingSession) private readonly trackingRepo: Repository<TrackingSession>,
        @InjectRepository(SavedLocation) private readonly savedRepo: Repository<SavedLocation>,
        private readonly cache: DriverLocationCacheService,
        private readonly zones: ZonesService,
        private readonly dispatchQueue: DispatchQueueService,
        private readonly realtime: RealtimeEventsService,
    ) { }

    async upsertDraft(userId: number, dto: UpsertDraftDto) {
        let draft = await this.ordersRepo.findOne({
            where: { user: { id: userId }, status: OrderStatus.DRAFT as any } as any,
            order: { createdAt: 'DESC' },
            relations: ['user'],
        });

        if (!draft) {
            draft = this.ordersRepo.create({
                user: { id: userId } as any,
                status: OrderStatus.DRAFT,
                serviceType: dto.serviceType || ServiceType.BIKE,
                suggestedPriceCents: 0,
                suggestedPrice: 0,
            });
        }

        if (dto.pickupLat != null && dto.pickupLng != null) {
            draft.pickupLocation = pointFromLatLng(dto.pickupLat, dto.pickupLng);
            draft.pickupAddress = dto.pickupAddress || draft.pickupAddress;
        }
        if (dto.dropoffLat != null && dto.dropoffLng != null) {
            draft.dropoffLocation = pointFromLatLng(dto.dropoffLat, dto.dropoffLng);
            draft.dropoffAddress = dto.dropoffAddress || draft.dropoffAddress;

            // Store as a recent destination (best-effort).
            const existing = await this.savedRepo.findOne({
                where: { user: { id: userId }, lat: dto.dropoffLat, lng: dto.dropoffLng } as any,
            });
            if (!existing) {
                await this.savedRepo.save(
                    this.savedRepo.create({
                        user: { id: userId } as any,
                        kind: 'recent',
                        label: dto.dropoffAddress || 'Recent destination',
                        address: dto.dropoffAddress || null,
                        lat: dto.dropoffLat,
                        lng: dto.dropoffLng,
                    }),
                );
            }
        }

        if (dto.serviceType) draft.serviceType = dto.serviceType;
        if (dto.estimatedPriceCents != null) {
            draft.suggestedPriceCents = dto.estimatedPriceCents;
            draft.suggestedPrice = dto.estimatedPriceCents / 100;
        }
        if (dto.distanceKm != null) draft.distanceKm = dto.distanceKm;
        if (dto.etaMinutes != null) draft.etaMinutes = Math.round(dto.etaMinutes);
        if (dto.weightKg != null) draft.packageWeightKg = dto.weightKg;
        if (dto.volumeM3 != null) draft.packageVolumeM3 = dto.volumeM3;

        const saved = await this.ordersRepo.save(draft);
        return {
            success: true,
            data: {
                draftOrder: {
                    id: saved.id,
                    status: saved.status,
                    serviceType: saved.serviceType,
                    pickupAddress: saved.pickupAddress,
                    dropoffAddress: saved.dropoffAddress,
                    estimatedPriceCents: saved.suggestedPriceCents,
                    distanceKm: saved.distanceKm,
                    etaMinutes: saved.etaMinutes,
                },
            },
        };
    }

    async confirmOrder(userId: number, dto: CreateOrderDto) {
        const draft = dto.draftOrderId
            ? await this.ordersRepo.findOne({ where: { id: dto.draftOrderId, user: { id: userId } } as any })
            : await this.ordersRepo.findOne({
                where: { user: { id: userId }, status: OrderStatus.DRAFT as any } as any,
                order: { createdAt: 'DESC' },
            });

        if (!draft) throw new NotFoundException('Draft order not found');
        if (draft.status !== OrderStatus.DRAFT) throw new BadRequestException('Order already confirmed');

        const pickup = draft.pickupLocation?.coordinates;
        const dropoff = draft.dropoffLocation?.coordinates;
        if (!pickup || !dropoff) throw new BadRequestException('Pickup and destination required');
        if (!draft.suggestedPriceCents || draft.suggestedPriceCents <= 0)
            throw new BadRequestException('Pricing required');

        const pickupLat = Number(pickup[1]);
        const pickupLng = Number(pickup[0]);

        const zone = await this.zones.findZone(pickupLat, pickupLng);
        if (!this.zones.isServiceEnabled(zone, draft.serviceType)) {
            throw new BadRequestException('Service unavailable in this zone');
        }

        const radiusKm = Number(process.env.DRIVER_SEARCH_RADIUS_KM || 50);
        let candidateIds: number[] = [];

        // If a specific biker was chosen by the customer, use them directly
        if (dto.preferredBikerId) {
            candidateIds = [dto.preferredBikerId];
        } else {
            const cached = await this.cache.nearby(pickupLat, pickupLng, radiusKm, 50);
            candidateIds = cached.map((c) => c.driverId);
        }

        const qr = this.dataSource.createQueryRunner();
        await qr.connect();
        await qr.startTransaction('READ COMMITTED');

        try {
            const user = await qr.manager
                .createQueryBuilder(User, 'u')
                .where('u.id = :id', { id: userId })
                .setLock('pessimistic_write')
                .getOne();
            if (!user) throw new NotFoundException('User not found');

            if (dto.paymentMethod === PaymentMethod.WALLET) {
                if (user.walletBalanceCents < draft.suggestedPriceCents) {
                    throw new BadRequestException('Insufficient wallet balance');
                }
                user.walletBalanceCents -= draft.suggestedPriceCents;
                await qr.manager.save(User, user);
            }

            const biker = await this.lockNearestDriver(qr, pickupLat, pickupLng, radiusKm, candidateIds, draft.serviceType);
            if (!biker) throw new ServiceUnavailableException('No drivers available');

            const lockedAt = new Date();
            const order = await qr.manager.findOne(Order, { where: { id: draft.id } as any, relations: ['user'] });
            if (!order || order.status !== OrderStatus.DRAFT) throw new BadRequestException('Draft changed');

            order.biker = biker;
            // Also explicitly update the lat/lng in the biker object for the order
            if (!biker.lastKnownLocation) {
                biker.lastKnownLocation = pointFromLatLng(pickupLat, pickupLng);
            }
            order.status = OrderStatus.ASSIGNED;
            order.finalPriceCents = order.suggestedPriceCents;
            order.finalPrice = (order.suggestedPriceCents || 0) / 100;
            await qr.manager.save(Order, order);

            const assignment = qr.manager.create(DriverAssignment, {
                order,
                biker,
                status: DriverAssignmentStatus.LOCKED,
                lockedAt,
                lockExpiresAt: new Date(Date.now() + Number(process.env.DRIVER_LOCK_TTL_SECONDS || 30) * 1000),
            });
            await qr.manager.save(DriverAssignment, assignment);

            const payment = qr.manager.create(Payment, {
                ride: order,
                customer: user,
                amount: order.suggestedPriceCents,
                currency: user.walletCurrency || 'USD',
                paymentType: 'ride_payment' as any,
                provider: dto.paymentMethod || 'cash',
                status: dto.paymentMethod === PaymentMethod.WALLET ? PaymentStatus.SUCCESS : PaymentStatus.PENDING,
            });
            await qr.manager.save(Payment, payment);

            const session = qr.manager.create(TrackingSession, {
                order,
                status: TrackingSessionStatus.ACTIVE,
                startedAt: new Date(),
            });
            await qr.manager.save(TrackingSession, session);

            biker.isAvailable = false;
            await qr.manager.save(Biker, biker);

            await qr.commitTransaction();

            // Dispatch push asynchronously.
            await this.dispatchQueue.enqueueDriverPush({
                driverId: biker.id,
                orderId: order.id,
                title: 'New delivery request',
                body: 'You have a new assignment. Open the app to accept.',
            });

            // Realtime events to customer + driver.
            this.realtime.emitToUser(user.id, 'order_assigned', {
                orderId: order.id,
                status: order.status,
                driver: {
                    id: biker.id,
                    name: biker.user?.name,
                    phone: biker.user?.phone,
                    vehicleType: biker.vehicleType,
                },
            });

            if (biker.user?.id) {
                this.realtime.emitToUser(biker.user.id, 'order_assigned', {
                    order: {
                        id: order.id,
                        status: order.status,
                        serviceType: order.serviceType,
                        pickupAddress: order.pickupAddress,
                        dropoffAddress: order.dropoffAddress,
                        priceCents: order.finalPriceCents ?? order.suggestedPriceCents,
                    },
                    customer: {
                        id: user.id,
                        name: user.name,
                        phone: user.phone,
                    },
                });
            }

            this.realtime.emitToOrder(order.id, 'order_status', {
                orderId: order.id,
                status: order.status,
                updatedAt: new Date().toISOString(),
            });

            // Broadcast to every online biker (including restricted mode) so they can see the request
            this.realtime.emitToAll('new_order_request', {
                orderId: order.id,
                serviceType: order.serviceType,
                pickupAddress: order.pickupAddress,
                dropoffAddress: order.dropoffAddress,
                priceCents: order.finalPriceCents ?? order.suggestedPriceCents,
                distanceKm: order.distanceKm,
                etaMinutes: order.etaMinutes,
                assignedBikerId: biker.id,
            });

            return {
                success: true,
                data: {
                    orderId: order.id,
                    driver: {
                        id: biker.id,
                        name: biker.user?.name,
                        vehicleType: biker.vehicleType,
                    },
                    tracking: {
                        wsPath: '/ws/tracking',
                        room: `order:${order.id}`,
                    },
                },
            };
        } catch (e) {
            await qr.rollbackTransaction();
            throw e;
        } finally {
            await qr.release();
        }
    }

    private async lockNearestDriver(
        qr: any,
        lat: number,
        lng: number,
        radiusKm: number,
        preferredIds: number[],
        serviceType: ServiceType,
    ): Promise<Biker | null> {
        const qb = qr.manager
            .createQueryBuilder(Biker, 'b')
            .leftJoinAndSelect('b.user', 'user')
            .where('b.isOnline = true')
            .andWhere('b.isAvailable = true');

        qb.setParameters({ lat, lng });

        // No strict vehicleType filter — any online available biker can take any job
        // (The customer already selected the biker they want)

        if (preferredIds && preferredIds.length > 0) {
            qb.andWhere('b.id IN (:...ids)', { ids: preferredIds });
        } else {
            // Auto-assignment: only pick drivers with active subscription or trial
            const now = new Date();
            qb.andWhere('(b.subscriptionStatus = :sStatus OR b.trialExpiryDate >= :now)', { sStatus: 'active', now });
            qb.andWhere(
                'ST_DWithin(b."lastKnownLocation", ST_SetSRID(ST_MakePoint(:lng, :lat), 4326), :radiusDeg)',
                { lng, lat, radiusDeg: radiusKm / 111.32 },
            );
        }

        qb.orderBy(
            'ST_Distance(b."lastKnownLocation", ST_SetSRID(ST_MakePoint(:lng, :lat), 4326))',
            'ASC',
        )
            .limit(1)
            .setLock('pessimistic_write')
            .setOnLocked('skip_locked');

        const biker = await qb.getOne();
        return biker || null;
    }
}
