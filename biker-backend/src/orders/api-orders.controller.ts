import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { OrdersService } from './orders.service';
import { OrderStatus } from './order.entity';
import { OrderFlowService } from './order-flow.service';
import { UpsertDraftDto } from './dto/upsert-draft.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { Roles } from '../common/roles.decorator';
import { UserRole } from '../users/user.entity';

@Controller('api/orders')
export class ApiOrdersController {
    constructor(
        private readonly orders: OrdersService,
        private readonly flow: OrderFlowService,
    ) { }

    @Post('draft')
    @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
    upsertDraft(@CurrentUser() user: any, @Body() dto: UpsertDraftDto) {
        return this.flow.upsertDraft(user.id, dto);
    }

    @Post('create')
    @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
    create(@CurrentUser() user: any, @Body() dto: CreateOrderDto) {
        return this.flow.confirmOrder(user.id, dto);
    }

    @Get('history')
    @Roles(UserRole.CUSTOMER, UserRole.DRIVER, UserRole.ADMIN)
    async history(@CurrentUser() user: any) {
        const orders = await this.orders.findHistoryForUser(user.id, 20);
        return { success: true, data: { orders } };
    }
    @Get('user-active')
    @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
    async getUserActive(@CurrentUser() user: any) {
        const results = await this.orders.findActiveForUser(user.id, 'customer');
        const order = results && results.length > 0 ? results[0] : null;
        return { success: true, data: { order } };
    }

    @Post(':id/cancel')
    @Roles(UserRole.CUSTOMER, UserRole.DRIVER, UserRole.ADMIN)
    async cancel(@CurrentUser() user: any, @Param('id') id: number) {
        // Find it first to ensure it belongs to the user or is the assigned biker
        const order = await this.orders.findOneWithRelations(Number(id));

        const isCustomer = String(order?.user?.id) === String(user.id);
        const isBiker = String(order?.biker?.user?.id) === String(user.id);
        const isAdmin = user.role === UserRole.ADMIN;

        if (!order || (!isCustomer && !isBiker && !isAdmin)) {
            return { success: false, message: 'Trip not found or unauthorized' };
        }
        await this.orders.updateStatus(Number(id), OrderStatus.CANCELLED);

        // Notify both parties
        this.flow.notifyStatusUpdate(Number(id), OrderStatus.CANCELLED);

        return { success: true, message: 'Trip has been cancelled' };
    }

    @Post('bid')
    @Roles(UserRole.DRIVER)
    async bid(@CurrentUser() user: any, @Body() body: { orderId: number, priceCents: number }) {
        // Need to find the biker id for the user
        const biker = await this.orders.findBikerIdForUser(user.id);
        if (!biker) return { success: false, message: 'Only drivers can bid' };
        return this.flow.placeBid(biker.id, body.orderId, body.priceCents);
    }

    @Post('accept-bid')
    @Roles(UserRole.CUSTOMER)
    async acceptBid(@CurrentUser() user: any, @Body() body: { bidId: number }) {
        return this.flow.acceptBid(user.id, body.bidId);
    }
}
