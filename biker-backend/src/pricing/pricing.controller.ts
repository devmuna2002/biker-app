import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { CalculatePricingDto } from './dto/calculate-pricing.dto';
import { RateLimit } from '../common/rate-limit.decorator';
import { RateLimitGuard } from '../common/rate-limit.guard';
import { Public } from '../common/public.decorator';

@Controller('api/pricing')
export class PricingController {
    constructor(private readonly pricing: PricingService) {}

    @UseGuards(RateLimitGuard)
    @RateLimit({ points: 20, durationSeconds: 60, keyPrefix: 'pricing' })
    @Public()
    @Post('calculate')
    calculate(@Body() dto: CalculatePricingDto) {
        return this.pricing.calculate(dto);
    }
}
