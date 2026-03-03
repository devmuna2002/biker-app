import { Module } from '@nestjs/common';
import { NegotiationGateway } from './negotiation.gateway';

@Module({
    providers: [NegotiationGateway],
})
export class NegotiationModule { }
