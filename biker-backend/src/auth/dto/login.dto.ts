import { IsString, MinLength, Contains } from 'class-validator';

export class LoginDto {
    @IsString()
    @Contains('@')
    email: string;

    @IsString()
    @MinLength(6)
    password: string;

    @IsString()
    role?: string;
}
