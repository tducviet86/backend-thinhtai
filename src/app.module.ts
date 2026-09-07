import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { AvailabilityModule } from './availability/availability.module';
import { BookingsModule } from './bookings/bookings.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { validateEnvironment } from './config/env.validation';
import { HealthController } from './health/health.controller';
import { LocationsModule } from './locations/locations.module';
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule } from './prisma/prisma.module';
import { PricingModule } from './pricing/pricing.module';
import { PropertiesModule } from './properties/properties.module';
import { SeoModule } from './seo/seo.module';
import { UnitsModule } from './units/units.module';

@Module({
  imports: [ConfigModule.forRoot({isGlobal:true,validate:validateEnvironment}),ThrottlerModule.forRoot([{ttl:60000,limit:100}]),PrismaModule,AuthModule,LocationsModule,PropertiesModule,UnitsModule,AvailabilityModule,PricingModule,BookingsModule,PaymentsModule,SeoModule],
  controllers:[HealthController],
  providers:[{provide:APP_GUARD,useClass:ThrottlerGuard},{provide:APP_GUARD,useClass:JwtAuthGuard},{provide:APP_GUARD,useClass:PermissionsGuard}],
})
export class AppModule {}
