import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GeoZone } from './geo-zone.entity';
import { ZonesService } from './zones.service';

@Module({
    imports: [TypeOrmModule.forFeature([GeoZone])],
    providers: [ZonesService],
    exports: [ZonesService],
})
export class ZonesModule implements OnModuleInit {
    constructor(private readonly zones: ZonesService) {}

    async onModuleInit() {
        await this.zones.ensureGlobalZone();
    }
}
