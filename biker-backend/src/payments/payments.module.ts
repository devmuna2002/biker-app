import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BikerFee } from './biker-fee.entity';
import { BikerSubscription } from './biker-subscription.entity';
import { Payment } from './payment.entity';
import { RideCompletionService } from '../orders/ride-completion.service';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { WebhooksController } from './webhooks.controller';
import { StripePaypalService } from './stripe-paypal.service';
import { Biker } from '../bikers/biker.entity';
import { Order } from '../orders/order.entity';
import { User } from '../users/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BikerFee,
      BikerSubscription,
      Payment,
      Biker,
      Order,
      User,
    ]),
  ],
  providers: [PaymentsService, RideCompletionService, StripePaypalService],
  controllers: [PaymentsController, WebhooksController],
  exports: [PaymentsService, StripePaypalService],
})
export class PaymentsModule { }
