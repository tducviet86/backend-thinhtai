import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { AvailabilityService } from '../availability/availability.service';
import { parseStay } from '../common/date-interval';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { CreateBookingDto, CreateHoldDto } from './dto/create-booking.dto';
@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService, private readonly availability: AvailabilityService, private readonly pricing: PricingService) {}
  async createHold(dto: CreateHoldDto) {
    const unitId = await this.pricing.resolveUnitId(dto); const { start, end } = parseStay(dto.checkIn, dto.checkOut);
    return this.prisma.$transaction(async (tx) => { await this.availability.lockUnit(tx, unitId); await tx.hold.updateMany({ where: { status: 'ACTIVE', expiresAt: { lte: new Date() } }, data: { status: 'EXPIRED' } }); await this.availability.assertAvailable(tx, unitId, start, end); return tx.hold.create({ data: { unitId, startDate: start, endDate: end, expiresAt: new Date(Date.now() + 15 * 60000) }, select: { id: true, startDate: true, endDate: true, expiresAt: true, status: true } }); }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
  async create(dto: CreateBookingDto) {
    const unitId = await this.pricing.resolveUnitId(dto); const { start, end } = parseStay(dto.checkIn, dto.checkOut);
    const calculated = await this.pricing.quote({ unitId, checkIn: dto.checkIn, checkOut: dto.checkOut, guests: dto.guestCount }, false);
    const supplied = await this.prisma.priceQuote.findUnique({ where: { id: dto.quoteId } });
    if (!supplied || supplied.expiresAt <= new Date() || supplied.unitId !== unitId || supplied.total.toFixed(2) !== calculated.total) throw new ConflictException('Quote is expired or price has changed');
    return this.prisma.$transaction(async (tx) => { await this.availability.lockUnit(tx, unitId); await tx.hold.updateMany({ where: { unitId, status: 'ACTIVE', expiresAt: { lte: new Date() } }, data: { status: 'EXPIRED' } }); await this.availability.assertAvailable(tx, unitId, start, end); const customer = await tx.customer.create({ data: { firstName: dto.firstName, lastName: dto.lastName, email: dto.email?.toLowerCase(), phone: dto.phone } }); const fees = new Prisma.Decimal(calculated.cleaningFee).add(calculated.serviceFee); return tx.booking.create({ data: { bookingCode: `TT-${new Date().getUTCFullYear()}-${randomBytes(8).toString('hex').toUpperCase()}`, customerId: customer.id, unitId, source: dto.source, checkIn: start, checkOut: end, guestCount: dto.guestCount, status: 'PENDING_PAYMENT', currency: calculated.currency, subtotal: calculated.subtotal, fees, discount: calculated.discount, total: calculated.total, normalTotal: calculated.total, depositRequired: calculated.requiredDeposit, remainingAmount: calculated.total }, select: { id: true, bookingCode: true, status: true, checkIn: true, checkOut: true, total: true, depositRequired: true, remainingAmount: true, currency: true } }); }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
  async findPublic(code: string) { const b = await this.prisma.booking.findUnique({ where: { bookingCode: code }, select: { bookingCode: true, status: true, checkIn: true, checkOut: true, guestCount: true, currency: true, total: true, paidAmount: true, remainingAmount: true, unit: { select: { publicCode: true, nameVi: true, nameEn: true } } } }); if (!b) throw new NotFoundException('Booking not found'); return b; }
}
