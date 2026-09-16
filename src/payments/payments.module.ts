import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { VnpayController } from './vnpay.controller';
import { VnpayService } from './vnpay.service';
@Module({ controllers: [PaymentsController, VnpayController], providers: [VnpayService] }) export class PaymentsModule {}
