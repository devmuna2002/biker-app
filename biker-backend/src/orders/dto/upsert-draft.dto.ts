import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ServiceType } from '../order.entity';

export class UpsertDraftDto {
    @IsOptional()
    @IsNumber()
    pickupLat?: number;

    @IsOptional()
    @IsNumber()
    pickupLng?: number;

    @IsOptional()
    @IsString()
    pickupAddress?: string;

    @IsOptional()
    @IsNumber()
    dropoffLat?: number;

    @IsOptional()
    @IsNumber()
    dropoffLng?: number;

    @IsOptional()
    @IsString()
    dropoffAddress?: string;

    @IsOptional()
    @IsEnum(ServiceType)
    serviceType?: ServiceType;

    @IsOptional()
    @IsNumber()
    @Min(0)
    estimatedPriceCents?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    distanceKm?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    etaMinutes?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    weightKg?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    volumeM3?: number;
}
