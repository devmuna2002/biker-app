import { Injectable, UnauthorizedException, ForbiddenException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { User, UserRole } from '../users/user.entity';
import { UserSession } from './user-session.entity';
import { Biker, DriverVehicleType } from '../bikers/biker.entity';
import { latLngFromPoint } from '../common/geo';
import { OtpPurpose } from './otp-code.entity';

export type JwtPayload = {
    sub: number;
    role: UserRole;
    sid: string;
    jti: string;
    tv: number;
};

@Injectable()
export class AuthService implements OnModuleInit {
    private supabase: SupabaseClient;

    constructor(
        @InjectRepository(User) private readonly usersRepo: Repository<User>,
        @InjectRepository(UserSession) private readonly sessionsRepo: Repository<UserSession>,
        @InjectRepository(Biker) private readonly bikersRepo: Repository<Biker>,
        private readonly jwt: JwtService,
    ) { }

    onModuleInit() {
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
        if (url && key) {
            this.supabase = createClient(url, key);
        }
    }

    async generateOtp(phoneOrEmail: string, purpose: OtpPurpose = OtpPurpose.PHONE_VERIFICATION, role?: string) {
        const isEmail = phoneOrEmail.includes('@');

        if (isEmail && this.supabase) {
            console.log(`[AuthService] Requesting Supabase OTP for ${phoneOrEmail}`);
            const { data, error } = await this.supabase.auth.signInWithOtp({
                email: phoneOrEmail.toLowerCase().trim(),
                options: {
                    shouldCreateUser: true, // Allow Supabase to create the user record
                }
            });

            if (error) {
                console.error('[AuthService] Supabase OTP error:', error.message);
                throw new UnauthorizedException(`Failed to send code: ${error.message}`);
            }

            return { success: true, message: 'Code sent via Supabase' };
        }

        // Fallback or phone logic (if phone is not in Supabase)
        // For now, if no Supabase, we fall back to nothing or error if it's email
        if (isEmail) throw new ForbiddenException('Supabase auth not configured');

        // Original phone logic if any
        return { success: false, message: 'Phone OTP not implemented via Supabase yet' };
    }

    async verifyOtp(phoneOrEmail: string, code: string, purpose: OtpPurpose = OtpPurpose.PHONE_VERIFICATION, role?: string) {
        const isEmail = phoneOrEmail.includes('@');

        if (isEmail && this.supabase) {
            console.log(`[AuthService] Verifying Supabase OTP for ${phoneOrEmail}`);
            const { data, error } = await this.supabase.auth.verifyOtp({
                email: phoneOrEmail.toLowerCase().trim(),
                token: code,
                type: 'email'
            });

            if (error) {
                throw new UnauthorizedException('Invalid or expired verification code');
            }

            return { success: true };
        }

        throw new UnauthorizedException('OTP verification failed');
    }

    async verifyPhone(phone: string) {
        const user = await this.usersRepo.findOne({ where: { phone } });
        if (!user) throw new ForbiddenException('User not found');

        user.isVerified = true;
        await this.usersRepo.save(user);

        return { success: true, verified: true };
    }

    async requestPasswordReset(phone: string) {
        return this.generateOtp(phone, OtpPurpose.PASSWORD_RESET);
    }

    async resetPassword(phone: string, code: string, newPassword: string) {
        await this.verifyOtp(phone, code, OtpPurpose.PASSWORD_RESET);

        const user = await this.usersRepo.findOne({ where: { phone } });
        if (!user) throw new ForbiddenException('User not found');

        user.passwordHash = await bcrypt.hash(newPassword, 10);
        user.tokenVersion += 1;
        await this.usersRepo.save(user);

        return { success: true };
    }

    async register(input: {
        name: string;
        email: string;
        contactEmail?: string;
        phone?: string;
        password: string;
        role?: UserRole;
        city?: string;
        country?: string;
        countryCode?: string;
        vehicleNumber?: string;
        vehicleDetails?: string;
        vehicleType?: string;
    }) {
        if (!input.name || !input.email || !input.password) {
            throw new ForbiddenException('Name, email and password are required');
        }

        const email = (input.email || '').toLowerCase().trim();
        const role = input.role || UserRole.CUSTOMER;

        const existing = await this.usersRepo.findOne({ where: { email, role } });
        if (existing) throw new ForbiddenException(`Email already registered as a ${role}`);

        const user = this.usersRepo.create({
            name: input.name.trim(),
            email,
            contactEmail: input.contactEmail ? input.contactEmail.toLowerCase().trim() : null,
            phone: input.phone ? input.phone.trim() : null,
            city: input.city || null,
            country: input.country || null,
            countryCode: input.countryCode || null,
            passwordHash: await bcrypt.hash(input.password, 10),
            role: input.role || UserRole.CUSTOMER,
        });
        const saved = await this.usersRepo.save(user);

        if (saved.role === UserRole.DRIVER) {
            const trialDays = 7;
            const trialExpiryAt = new Date();
            trialExpiryAt.setDate(trialExpiryAt.getDate() + trialDays);

            const biker = this.bikersRepo.create({
                user: saved,
                vehicleDetails: input.vehicleDetails || 'N/A',
                vehicleNumber: input.vehicleNumber || null,
                vehicleType: DriverVehicleType.BIKE, // Force BIKE as requested
                isOnline: false,
                isAvailable: false,
                verificationStatus: 'approved',
                trialExpiryDate: trialExpiryAt,
                subscriptionStatus: 'inactive',
            } as any);
            await this.bikersRepo.save(biker);
        }
        return this.issueSession(saved, { ip: null, userAgent: null });
    }

    async login(input: { email: string; password: string; role?: string }, meta: { ip: string | null; userAgent: string | null }) {
        if (!input.email || !input.password) {
            throw new UnauthorizedException('Email and password are required');
        }

        const email = input.email.toLowerCase().trim();
        const findCriteria: any = { email };
        if (input.role) findCriteria.role = input.role;

        const user = await this.usersRepo.findOne({ where: findCriteria });
        if (!user) throw new UnauthorizedException('User not found');
        if (!user.passwordHash) throw new UnauthorizedException('Password login not enabled for this account');
        if (user.disabledAt) throw new ForbiddenException('Account has been disabled');

        const ok = await bcrypt.compare(input.password, user.passwordHash);
        if (!ok) throw new UnauthorizedException('Invalid password');
        return this.issueSession(user, meta);
    }

    async providerAuth(input: {
        email: string;
        name: string;
        provider: string;
        providerId: string;
        role?: string;
        photo?: string;
        vehicleDetails?: string;
        vehicleNumber?: string;
    }, meta: { ip: string | null; userAgent: string | null }) {
        if (!input.email || !input.provider || !input.providerId) {
            throw new ForbiddenException('Missing provider information');
        }

        const email = input.email.toLowerCase().trim();
        const role = (input.role as UserRole) || UserRole.CUSTOMER;

        let user = await this.usersRepo.findOne({ where: { email, role } });

        if (!user) {
            const password = `${input.provider}_${input.providerId}`;
            user = this.usersRepo.create({
                name: input.name.trim(),
                email,
                role,
                photo: input.photo,
                passwordHash: await bcrypt.hash(password, 10),
            });
            user = await this.usersRepo.save(user);

            if (user.role === UserRole.DRIVER) {
                const trialDays = 7;
                const trialExpiryAt = new Date();
                trialExpiryAt.setDate(trialExpiryAt.getDate() + trialDays);

                const biker = this.bikersRepo.create({
                    user: user,
                    vehicleDetails: input.vehicleDetails || 'N/A',
                    vehicleNumber: input.vehicleNumber || null,
                    vehicleType: DriverVehicleType.BIKE,
                    isOnline: false,
                    isAvailable: false,
                    verificationStatus: 'approved',
                    trialExpiryDate: trialExpiryAt,
                    subscriptionStatus: 'inactive',
                } as any);
                await this.bikersRepo.save(biker);
            }
        }

        if (user.disabledAt) throw new ForbiddenException('Account has been disabled');

        return this.issueSession(user, meta);
    }

    async logout(sessionId: string, userId: number) {
        const session = await this.sessionsRepo.findOne({ where: { id: sessionId }, relations: ['user'] });
        if (!session || session.user?.id !== userId) return { success: true };
        session.revokedAt = new Date();
        await this.sessionsRepo.save(session);

        // If user is a biker, ensure they go offline in the DB too
        if (session.user.role === UserRole.DRIVER) {
            await this.bikersRepo.update({ user: { id: userId } as any }, { isOnline: false, isAvailable: false });
        }

        return { success: true };
    }

    async validateTokenAndSession(payload: JwtPayload) {
        const user = await this.usersRepo.findOne({ where: { id: payload.sub } });
        if (!user) throw new UnauthorizedException('Invalid token');
        if (user.disabledAt) throw new UnauthorizedException('Account disabled');
        if (user.tokenVersion !== payload.tv) throw new UnauthorizedException('Session expired');

        const session = await this.sessionsRepo.findOne({ where: { id: payload.sid }, relations: ['user'] });
        if (!session || session.user?.id !== user.id) throw new UnauthorizedException('Invalid session');
        if (session.revokedAt) throw new UnauthorizedException('Session revoked');
        if (session.expiresAt.getTime() < Date.now()) throw new UnauthorizedException('Token expired');

        return {
            id: user.id,
            role: user.role,
            sessionId: session.id,
        };
    }

    async authenticateToken(token: string) {
        const payload = (await this.jwt.verifyAsync(token, {
            secret: process.env.JWT_SECRET || 'dev-secret-change-me',
            issuer: process.env.JWT_ISSUER || 'biker-backend',
            audience: process.env.JWT_AUDIENCE || 'biker-app',
        })) as JwtPayload;
        return this.validateTokenAndSession(payload);
    }

    private async issueSession(user: User, meta: { ip: string | null; userAgent: string | null }) {
        const now = Date.now();
        const ttlSeconds = Number(process.env.JWT_TTL_SECONDS || 3600);
        const expiresAt = new Date(now + ttlSeconds * 1000);
        const session = this.sessionsRepo.create({
            user,
            jti: randomUUID(),
            expiresAt,
            revokedAt: null,
            ip: meta.ip,
            userAgent: meta.userAgent,
        });
        const savedSession = await this.sessionsRepo.save(session);

        const payload: JwtPayload = {
            sub: user.id,
            role: user.role,
            sid: savedSession.id,
            jti: savedSession.jti,
            tv: user.tokenVersion,
        };

        const token = await this.jwt.signAsync(payload, {
            expiresIn: ttlSeconds,
            issuer: process.env.JWT_ISSUER || 'biker-backend',
            audience: process.env.JWT_AUDIENCE || 'biker-app',
        });

        // Fetch Biker data if driver
        let biker: Biker | null = null;
        if (user.role === UserRole.DRIVER) {
            biker = await this.bikersRepo.findOne({ where: { user: { id: user.id } as any } });
        }

        return {
            success: true,
            data: {
                accessToken: token,
                expiresIn: ttlSeconds,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.contactEmail || '',
                    role: user.role,
                    phone: user.phone,
                    city: user.city,
                    country: user.country,
                    countryCode: user.countryCode,
                    photo: user.photo,
                    serviceArea: user.serviceAreaCenter
                        ? { ...(latLngFromPoint(user.serviceAreaCenter) as any), radiusKm: user.serviceAreaRadiusKm }
                        : null,
                    wallet: { balanceCents: user.walletBalanceCents, currency: user.walletCurrency },
                    licenseVerificationPhoto: biker?.licenseVerificationPhoto || null,
                    verificationStatus: biker?.verificationStatus || 'pending',
                    trialExpiryDate: biker?.trialExpiryDate || null,
                },
            },
        };
    }
}
