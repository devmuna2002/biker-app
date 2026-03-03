import { IsNumber, IsOptional } from 'class-validator';

export class UpdateDriverLocationDto {
    @IsNumber()
    lat: number;

    @IsNumber()
    lng: number;

    @IsOptional()
    @IsNumber()
    speedMps?: number;

    @IsOptional()
    @IsNumber()
    headingDeg?: number;

    @IsOptional()
    @IsNumber()
    accuracyM?: number;
}
