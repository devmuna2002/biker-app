import { IsEnum, IsOptional, IsNumber } from 'class-validator';
import { PaymentMethod } from '../../payments/payment.entity';

export class CreateOrderDto {
    @IsOptional()
    @IsNumber()
    draftOrderId?: number;

    @IsEnum(PaymentMethod)
    paymentMethod: PaymentMethod;

    @IsOptional()
    @IsNumber()
    preferredBikerId?: number;
}

