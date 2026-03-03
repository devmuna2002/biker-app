import { IsEnum } from 'class-validator';
import { OrderStatus } from '../../orders/order.entity';

export class UpdateOrderStatusDto {
    @IsEnum(OrderStatus)
    status: OrderStatus;
}
