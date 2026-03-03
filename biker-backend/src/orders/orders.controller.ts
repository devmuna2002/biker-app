import { Controller, Get, Post, Body, Patch, Param } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { Order, OrderStatus } from './order.entity';

@Controller('orders')
export class OrdersController {
    constructor(private readonly ordersService: OrdersService) { }

    @Get()
    findAll() {
        return this.ordersService.findAll();
    }

    @Post()
    create(@Body() orderData: Partial<Order>) {
        return this.ordersService.create(orderData);
    }

    @Get('user/:userId')
    findHistory(@Param('userId') userId: string) {
        return this.ordersService.findHistoryForUser(+userId);
    }

    @Post('courier')
    createCourier(@Body() orderData: Partial<Order>) {
        return this.ordersService.createCourierOrder(orderData);
    }

    @Post('intercity')
    createIntercity(@Body() orderData: Partial<Order>) {
        return this.ordersService.createIntercityOrder(orderData);
    }

    @Patch(':id/status')
    updateStatus(@Param('id') id: number, @Body('status') status: OrderStatus) {
        return this.ordersService.updateStatus(Number(id), status);
    }

    @Patch(':id/assign')
    assignBiker(
        @Param('id') id: number,
        @Body('bikerId') bikerId: number,
        @Body('finalPrice') finalPrice: number,
    ) {
        return this.ordersService.assignBiker(Number(id), Number(bikerId), finalPrice);
    }
}
