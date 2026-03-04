import { IsString, IsOptional, Contains } from 'class-validator';

export class ProviderAuthDto {
    @IsString()
    @Contains('@')
    email: string;

    @IsString()
    name: string;

    @IsString()
    provider: string;

    @IsString()
    providerId: string;

    @IsString()
    @IsOptional()
    role?: string;

    @IsString()
    @IsOptional()
    photo?: string;

    @IsString()
    @IsOptional()
    vehicleDetails?: string;

    @IsString()
    @IsOptional()
    vehicleNumber?: string;
}
