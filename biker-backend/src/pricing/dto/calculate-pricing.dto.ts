import { IsEnum, IsNumber, IsOptional, Min } from 'class-validator';
import { ServiceType } from '../../orders/order.entity';

export class CalculatePricingDto {
    @IsNumber()
    pickupLat: number;

    @IsNumber()
    pickupLng: number;

    @IsNumber()
    dropoffLat: number;

    @IsNumber()
    dropoffLng: number;

    @IsEnum(ServiceType)
    serviceType: ServiceType;

    @IsOptional()
    @IsNumber()
    @Min(0)
    weightKg?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    volumeM3?: number;

    @IsOptional()
    vehicleType?: string;

    @IsOptional()
    @IsNumber()
    @Min(0)
    distance?: number;
}
