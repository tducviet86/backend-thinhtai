import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AvailabilityService } from '../availability/availability.service';
import { eachNight, nightsBetween, parseStay } from '../common/date-interval';
import { PrismaService } from '../prisma/prisma.service';
export interface QuoteInput { unitId?: string; publicCode?: string; checkIn: string; checkOut: string; guests: number; promoCode?: string }
@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService, private readonly availability: AvailabilityService) {}
  async resolveUnitId(input: Pick<QuoteInput, 'unitId' | 'publicCode'>): Promise<string> {
    if (!input.unitId && !input.publicCode) throw new BadRequestException('unitId or publicCode is required');
    const unit = await this.prisma.unit.findFirst({ where: input.unitId ? { id: input.unitId } : { publicCode: input.publicCode }, select: { id: true } });
    if (!unit) throw new NotFoundException('Unit not found');
    return unit.id;
  }
  async quote(input: QuoteInput, persist = true) {
    const unitId = await this.resolveUnitId(input);
    const { start, end } = parseStay(input.checkIn, input.checkOut); const nights = nightsBetween(start, end);
    if (nights > 365) throw new BadRequestException('Stay cannot exceed 365 nights');
    const unit = await this.prisma.unit.findUnique({ where: { id: unitId }, select: { status: true, property: { select: { status: true } }, id: true, basePrice: true, currency: true, cleaningFee: true, serviceFeeRate: true, depositRate: true, maxGuests: true } });
    if (!unit) throw new NotFoundException('Unit not found');
    if (unit.status !== 'PUBLISHED' || unit.property.status !== 'ACTIVE') throw new BadRequestException('Căn hộ chưa mở bán.');
    if (input.guests > unit.maxGuests) throw new BadRequestException('Guest count exceeds unit capacity');
    if (!(await this.availability.isAvailable(unitId, start, end))) throw new ConflictException('Unit is unavailable for the requested interval');
    const dates = eachNight(start, end); const overrides = await this.prisma.dailyRate.findMany({ where: { unitId, date: { gte: start, lt: end } } });
    if (overrides.some(rate => rate.minStay && nights < rate.minStay)) throw new BadRequestException('Kỳ nghỉ chưa đáp ứng số đêm tối thiểu của giá theo ngày.');
    const byDate = new Map(overrides.map((r) => [r.date.toISOString().slice(0, 10), r.amount]));
    const weekend = await this.prisma.ratePlan.findFirst({ where: { unitId, active: true } });
    const breakdown = dates.map((date) => { const key = date.toISOString().slice(0, 10); const special = byDate.get(key); const isWeekend = [0, 6].includes(date.getUTCDay()); const amount = special ?? (isWeekend && weekend ? unit.basePrice.mul(weekend.weekendMultiplier) : unit.basePrice); return { date: key, amount: amount.toFixed(2), source: special ? 'SPECIAL_DATE' : isWeekend && weekend ? 'WEEKEND' : 'BASE' }; });
    const subtotal = breakdown.reduce((sum, n) => sum.add(n.amount), new Prisma.Decimal(0)); const cleaningFee = unit.cleaningFee; const serviceFee = subtotal.mul(unit.serviceFeeRate).toDecimalPlaces(2);
    let discount = new Prisma.Decimal(0); if (input.promoCode) { const p = await this.prisma.promotion.findFirst({ where: { code: input.promoCode.toUpperCase(), active: true, startsAt: { lte: new Date() }, endsAt: { gte: new Date() } } }); if (!p) throw new BadRequestException('Promotion is invalid or expired'); discount = p.percentOff ? subtotal.mul(p.percentOff).div(100) : p.amountOff ?? discount; discount = Prisma.Decimal.min(discount, subtotal); }
    const total = subtotal.add(cleaningFee).add(serviceFee).sub(discount); const requiredDeposit = total.mul(unit.depositRate).toDecimalPlaces(2); const expiresAt = new Date(Date.now() + 15 * 60000);
    const data = { currency: unit.currency, nights, nightlyBreakdown: breakdown, subtotal: subtotal.toFixed(2), cleaningFee: cleaningFee.toFixed(2), serviceFee: serviceFee.toFixed(2), discount: discount.toFixed(2), total: total.toFixed(2), requiredDeposit: requiredDeposit.toFixed(2), remainingAmount: total.sub(requiredDeposit).toFixed(2), expiresAt };
    if (!persist) return { ...data, quoteId: null, unitId };
    const record = await this.prisma.priceQuote.create({ data: { unitId, checkIn: start, checkOut: end, guests: input.guests, currency: unit.currency, breakdown, subtotal, cleaningFee, serviceFee, discount, total, requiredDeposit, expiresAt } });
    return { ...data, quoteId: record.id };
  }
}
