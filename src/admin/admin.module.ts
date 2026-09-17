import { Module } from '@nestjs/common';
import { AvailabilityModule } from '../availability/availability.module';
import { PricingModule } from '../pricing/pricing.module';
import { BookingStateService } from '../bookings/booking-state.service';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
@Module({ imports: [AvailabilityModule, PricingModule], controllers: [AdminController], providers: [AdminService, BookingStateService] })
export class AdminModule {}
