import { Controller, Get, Param, Query } from '@nestjs/common';
import { ServiceCatalogService } from './service-catalog.service';
import { ServiceType } from '../orders/order.entity';
import { ZonesService } from '../zones/zones.service';
import { Public } from '../common/public.decorator';

@Controller('api/services')
export class ServiceCatalogController {
    constructor(
        private readonly catalog: ServiceCatalogService,
        private readonly zones: ZonesService,
    ) {}

    @Public()
    @Get(':type')
    async getService(@Param('type') type: string, @Query('lat') lat?: string, @Query('lng') lng?: string) {
        const normalized = type.toLowerCase() as ServiceType;
        const res = await this.catalog.getByType(normalized);
        if (lat != null && lng != null) {
            const zone = await this.zones.findZone(Number(lat), Number(lng));
            return {
                ...res,
                data: {
                    ...res.data,
                    availability: {
                        zone: zone ? { id: zone.id, code: zone.code, name: zone.name } : null,
                        isAvailable: this.zones.isServiceEnabled(zone, normalized),
                    },
                },
            };
        }
        return res;
    }
}
