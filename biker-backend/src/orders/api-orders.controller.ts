import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { OrdersService } from './orders.service';
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
}
