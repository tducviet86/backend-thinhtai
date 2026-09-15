import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';
import { eachNight } from '../common/date-interval';
import { PrismaService } from '../prisma/prisma.service';
const OCCUPYING: BookingStatus[] = ['PENDING_PAYMENT','CONFIRMED','CHECKED_IN'];
@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}
  async lockUnit(tx: Prisma.TransactionClient, unitId: string): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${unitId}, 0))`;
  }
  async assertAvailable(tx: Prisma.TransactionClient, unitId: string, start: Date, end: Date, excludeBookingId?: string): Promise<void> {
    const now = new Date();
    const [booking, hold, block] = await Promise.all([
      tx.booking.findFirst({ where:{ unitId, id: excludeBookingId ? { not:excludeBookingId }:undefined, status:{in:OCCUPYING}, checkIn:{lt:end}, checkOut:{gt:start} }, select:{id:true} }),
      tx.hold.findFirst({ where:{ unitId, status:'ACTIVE', expiresAt:{gt:now}, startDate:{lt:end}, endDate:{gt:start} }, select:{id:true} }),
      tx.availabilityBlock.findFirst({ where:{ unitId, state:{in:['BLOCKED','MAINTENANCE']}, startDate:{lt:end}, endDate:{gt:start} }, select:{id:true} }),
    ]);
    if (booking || hold || block) throw new ConflictException('Unit is unavailable for the requested interval');
  }
  async isAvailable(unitId:string,start:Date,end:Date):Promise<boolean> {
    try { await this.prisma.$transaction(async(tx)=>this.assertAvailable(tx,unitId,start,end)); return true; } catch(e){ if(e instanceof ConflictException)return false; throw e; }
  }

  async unavailableNights(publicCode: string, start: Date, end: Date): Promise<string[]> {
    const unit = await this.prisma.unit.findUnique({ where: { publicCode }, select: { id: true } });
    if (!unit) throw new NotFoundException('Unit not found');
    const now = new Date();
    const [bookings, holds, blocks] = await Promise.all([
      this.prisma.booking.findMany({ where: { unitId: unit.id, status: { in: OCCUPYING }, checkIn: { lt: end }, checkOut: { gt: start } }, select: { checkIn: true, checkOut: true } }),
      this.prisma.hold.findMany({ where: { unitId: unit.id, status: 'ACTIVE', expiresAt: { gt: now }, startDate: { lt: end }, endDate: { gt: start } }, select: { startDate: true, endDate: true } }),
      this.prisma.availabilityBlock.findMany({ where: { unitId: unit.id, state: { in: ['BLOCKED', 'MAINTENANCE'] }, startDate: { lt: end }, endDate: { gt: start } }, select: { startDate: true, endDate: true } }),
    ]);
    const nights = new Set<string>();
    for (const interval of [
      ...bookings.map(({ checkIn, checkOut }) => ({ start: checkIn, end: checkOut })),
      ...holds.map(({ startDate, endDate }) => ({ start: startDate, end: endDate })),
      ...blocks.map(({ startDate, endDate }) => ({ start: startDate, end: endDate })),
    ]) {
      const clippedStart = interval.start > start ? interval.start : start;
      const clippedEnd = interval.end < end ? interval.end : end;
      eachNight(clippedStart, clippedEnd).forEach((date) => nights.add(date.toISOString().slice(0, 10)));
    }
    return [...nights].sort();
  }
}
