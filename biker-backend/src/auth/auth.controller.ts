import { Body, Controller, Post, Req, HttpCode, HttpStatus, Get, UseGuards } from '@nestjs/common';
import { Public } from '../common/public.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ProviderAuthDto } from './dto/provider.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('api/auth')
export class AuthController {
    constructor(private readonly auth: AuthService) { }

    @Public()
    @Get('health')
    healthCheck() {
        return { success: true, message: 'Auth service is healthy' };
    }

    @Public()
    @Post('register')
    async register(@Body() dto: RegisterDto, @Req() req: any) {
        try {
            return await this.auth.register(dto);
        } catch (error) {
            return {
                success: false,
                message: error?.message || 'Registration failed'
            };
        }
    }

    @Public()
    @Post('login')
    async login(@Body() dto: LoginDto, @Req() req: any) {
        try {
            const meta = {
                ip: (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress || null,
                userAgent: (req.headers['user-agent'] as string) || null,
            };
            return await this.auth.login(dto, meta);
        } catch (error) {
            return {
                success: false,
                message: error?.message || 'Login failed'
            };
        }
    }

    @Public()
    @Post('provider')
    async providerAuth(@Body() dto: ProviderAuthDto, @Req() req: any) {
        try {
            const meta = {
                ip: (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress || null,
                userAgent: (req.headers['user-agent'] as string) || null,
            };
            return await this.auth.providerAuth(dto, meta);
        } catch (error) {
            return {
                success: false,
                message: error?.message || 'Provider authentication failed'
            };
        }
    }

    @Public()
    @Post('otp/generate')
    @HttpCode(HttpStatus.OK)
    generateOtp(@Body() dto: { identifier: string; purpose?: string; role?: string }) {
        return this.auth.generateOtp(dto.identifier, dto.purpose as any, dto.role);
    }

    @Public()
    @Post('otp/verify')
    @HttpCode(HttpStatus.OK)
    verifyOtp(@Body() dto: { identifier: string; code: string; purpose?: string; role?: string }) {
        return this.auth.verifyOtp(dto.identifier, dto.code, dto.purpose as any, dto.role);
    }

    @Public()
    @Post('otp/verify-phone')
    @HttpCode(HttpStatus.OK)
    verifyPhone(@Body() dto: { phone: string }) {
        return this.auth.verifyPhone(dto.phone);
    }

    @Public()
    @Post('otp/request-reset')
    @HttpCode(HttpStatus.OK)
    requestPasswordReset(@Body() dto: { identifier: string }) {
        return this.auth.requestPasswordReset(dto.identifier);
    }

    @Public()
    @Post('otp/reset-password')
    @HttpCode(HttpStatus.OK)
    resetPassword(@Body() dto: { identifier: string; code: string; newPassword: string }) {
        return this.auth.resetPassword(dto.identifier, dto.code, dto.newPassword);
    }

    @UseGuards(JwtAuthGuard)
    @Post('logout')
    logout(@CurrentUser() user: any) {
        return this.auth.logout(user.sessionId, user.id);
    }

    @UseGuards(JwtAuthGuard)
    @Get('me')
    me(@CurrentUser() user: any) {
        return { success: true, data: { user } };
    }
}
