import { IsString, IsOptional, IsNumber } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateMeDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    phone?: string;

    @IsOptional()
    @IsString()
    photo?: string;

    @IsOptional()
    @IsString()
    contactEmail?: string;

    @IsOptional()
    @IsString()
    city?: string;

    @IsOptional()
    @IsString()
    country?: string;

    @IsOptional()
    @IsString()
    countryCode?: string;

    @IsOptional()
    @Transform(({ value }) => (value !== undefined && value !== null ? Number(value) : undefined))
    @IsNumber()
    serviceAreaLat?: number;

    @IsOptional()
    @Transform(({ value }) => (value !== undefined && value !== null ? Number(value) : undefined))
    @IsNumber()
    serviceAreaLng?: number;

    @IsOptional()
    @Transform(({ value }) => (value !== undefined && value !== null ? Number(value) : undefined))
    @IsNumber()
    serviceAreaRadiusKm?: number;

    // Biker-specific fields (ignored by the general updateMe but accepted to avoid 400)
    @IsOptional()
    @IsString()
    vehicleDetails?: string;

    @IsOptional()
    @IsString()
    vehicleNumber?: string;

    @IsOptional()
    @IsString()
    vehicleType?: string;

    @IsOptional()
    @IsString()
    paymentMethodPreference?: string;

    @IsOptional()
    @IsString()
    mobileMoneyNumber?: string;

    @IsOptional()
    @IsString()
    paypalEmail?: string;

    @IsOptional()
    @IsString()
    licenseVerificationPhoto?: string;
}
