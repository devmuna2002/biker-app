import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeliveryService } from './delivery-service.entity';
import { ServiceCatalogService } from './service-catalog.service';
import { ServiceCatalogController } from './service-catalog.controller';
import { ZonesModule } from '../zones/zones.module';

@Module({
    imports: [TypeOrmModule.forFeature([DeliveryService]), ZonesModule],
    providers: [ServiceCatalogService],
    controllers: [ServiceCatalogController],
    exports: [ServiceCatalogService],
})
export class ServiceCatalogModule implements OnModuleInit {
    constructor(private readonly catalog: ServiceCatalogService) {}

    async onModuleInit() {
        await this.catalog.ensureSeedDefaults();
    }
}
