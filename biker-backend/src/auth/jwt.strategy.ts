import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService, JwtPayload } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(private readonly auth: AuthService) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: process.env.JWT_SECRET || 'dev-secret-change-me',
            issuer: process.env.JWT_ISSUER || 'biker-backend',
            audience: process.env.JWT_AUDIENCE || 'biker-app',
        });
    }

    async validate(payload: JwtPayload) {
        try {
            return await this.auth.validateTokenAndSession(payload);
        } catch {
            throw new UnauthorizedException('Invalid or expired token');
        }
    }
}
