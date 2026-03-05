import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus } from './order.entity';
import { Biker } from '../bikers/biker.entity';

@Injectable()
export class OrdersService {
    constructor(
        @InjectRepository(Order)
        private ordersRepository: Repository<Order>,
        @InjectRepository(Biker)
        private bikersRepository: Repository<Biker>,
    ) { }

    findAll() {
        return this.ordersRepository.find({ relations: ['user', 'biker'] });
    }

    async findHistoryForUser(userId: number, limit: number = 20) {
        return this.ordersRepository.find({
            where: [
                { user: { id: userId } },
                { biker: { id: userId } }, // In case they were the driver
            ] as any,
            order: { createdAt: 'DESC' },
            take: limit,
            relations: ['biker', 'biker.user', 'user'],
        });
    }

    async findBikerHistory(bikerId: number, limit: number = 20) {
        return this.ordersRepository.find({
            where: { biker: { id: bikerId } } as any,
            order: { createdAt: 'DESC' },
            take: limit,
            relations: ['user', 'biker', 'biker.user'],
        });
    }

    async findActiveForUser(userId: number, roleFilter?: 'customer' | 'biker') {
        const where: any[] = [];

        if (!roleFilter || roleFilter === 'customer') {
            where.push(
                { user: { id: userId }, status: OrderStatus.PENDING_BIDS as any },
                { user: { id: userId }, status: OrderStatus.ASSIGNED as any },
                { user: { id: userId }, status: OrderStatus.PICKED_UP as any },
                { user: { id: userId }, status: OrderStatus.IN_TRANSIT as any },
            );
        }

        if (!roleFilter || roleFilter === 'biker') {
            where.push(
                { biker: { user: { id: userId } }, status: OrderStatus.ASSIGNED as any },
                { biker: { user: { id: userId } }, status: OrderStatus.PICKED_UP as any },
                { biker: { user: { id: userId } }, status: OrderStatus.IN_TRANSIT as any },
            );
        }

        return this.ordersRepository.find({
            where: where as any,
            order: { createdAt: 'DESC' },
            relations: ['biker', 'biker.user', 'user'],
        });
    }

    async findLastCompletedForUser(userId: number, limit: number = 10) {
        return this.ordersRepository.find({
            where: { user: { id: userId }, status: OrderStatus.COMPLETED as any } as any,
            order: { createdAt: 'DESC' },
            take: limit,
            relations: ['biker', 'biker.user'],
        });
    }

    async createCourierOrder(orderData: Partial<Order>) {
        // Calculate price based on distance and category
        const distance = 10; // Mocked distance
        const basePrice = 5;
        const categoryMultiplier = { small: 1, medium: 1.5, large: 2 }[orderData.packageCategory] || 1;
        const finalPrice = basePrice + (distance * 0.5) * categoryMultiplier;

        const order = this.ordersRepository.create({
            ...orderData,
            suggestedPrice: finalPrice,
            orderType: 'courier' as any,
        });
        return this.ordersRepository.save(order);
    }

    async createIntercityOrder(orderData: Partial<Order>) {
        const order = this.ordersRepository.create({
            ...orderData,
            orderType: 'intercity' as any,
        });
        return this.ordersRepository.save(order);
    }

    create(orderData: Partial<Order>) {
        const order = this.ordersRepository.create(orderData);
        return this.ordersRepository.save(order);
    }

    async updateStatus(id: number, status: OrderStatus) {
        await this.ordersRepository.update(id, { status });
        return this.ordersRepository.findOne({ where: { id }, relations: ['user', 'biker'] });
    }

    async assignBiker(orderId: number, bikerId: number, finalPrice: number) {
        await this.ordersRepository.update(orderId, {
            biker: { id: bikerId } as any,
            status: OrderStatus.ASSIGNED,
            finalPrice,
        });
        return this.ordersRepository.findOne({ where: { id: orderId } as any, relations: ['user', 'biker'] });
    }


    async findOneWithRelations(id: number) {
        return this.ordersRepository.findOne({ where: { id } as any, relations: ['user', 'biker', 'biker.user'] });
    }

    async findBikerIdForUser(userId: number) {
        const biker = await this.bikersRepository.findOne({ where: { user: { id: userId } } as any });
        return biker;
    }
}
