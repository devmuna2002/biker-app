import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrustedContact } from './trusted-contact.entity';
import { SafetyService } from './safety.service';
import { SafetyController } from './safety.controller';

@Module({
    imports: [TypeOrmModule.forFeature([TrustedContact])],
    providers: [SafetyService],
    controllers: [SafetyController],
    exports: [SafetyService],
})
export class SafetyModule { }
