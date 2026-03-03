import {
    CanActivate,
    ExecutionContext,
    Injectable,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimiterMemory, RateLimiterRedis } from 'rate-limiter-flexible';
import { RATE_LIMIT_KEY, RateLimitConfig } from './rate-limit.decorator';
import Redis from 'ioredis';

@Injectable()
export class RateLimitGuard implements CanActivate {
    private memoryLimiters = new Map<string, RateLimiterMemory>();
    private redisLimiters = new Map<string, RateLimiterRedis>();
    private redis: Redis | null;

    constructor(private readonly reflector: Reflector) {
        const url = process.env.REDIS_URL;
        this.redis = url ? new Redis(url, { maxRetriesPerRequest: 1 }) : null;
    }

    async canActivate(context: ExecutionContext) {
        const config = this.reflector.getAllAndOverride<RateLimitConfig>(RATE_LIMIT_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (!config) return true;

        const req = context.switchToHttp().getRequest();
        const userId = req.user?.id;
        const ip = (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress || 'unknown';
        const route = `${req.method}:${req.route?.path || req.url}`;
        const key = `${config.keyPrefix || 'rl'}:${route}:${userId || ip}`;
        const limiter = this.getLimiter(config);

        try {
            await limiter.consume(key, 1);
            return true;
        } catch {
            throw new HttpException('Rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
        }
    }

    private getLimiter(config: RateLimitConfig) {
        const id = `${config.points}:${config.durationSeconds}`;

        if (this.redis) {
            const existing = this.redisLimiters.get(id);
            if (existing) return existing;
            const limiter = new RateLimiterRedis({
                storeClient: this.redis as any,
                points: config.points,
                duration: config.durationSeconds,
                keyPrefix: config.keyPrefix || 'rl',
            });
            this.redisLimiters.set(id, limiter);
            return limiter;
        }

        const existing = this.memoryLimiters.get(id);
        if (existing) return existing;
        const limiter = new RateLimiterMemory({ points: config.points, duration: config.durationSeconds });
        this.memoryLimiters.set(id, limiter);
        return limiter;
    }
}
