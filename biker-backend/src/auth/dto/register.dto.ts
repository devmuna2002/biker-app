import { IsOptional, IsString, MinLength, IsEnum, Contains } from 'class-validator';
import { UserRole } from '../../users/user.entity';

export class RegisterDto {
    @IsString()
    name: string;

    @IsString()
    @Contains('@')
    email: string;

    @IsOptional()
    @IsString()
    contactEmail?: string;

    @IsOptional()
    @IsString()
    phone?: string;

    @IsString()
    @MinLength(6)
    password: string;

    @IsOptional()
    @IsEnum(UserRole)
    role?: UserRole;

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
    @IsString()
    vehicleNumber?: string;

    @IsOptional()
    @IsString()
    vehicleDetails?: string;

    @IsOptional()
    @IsString()
    vehicleType?: string;
}
