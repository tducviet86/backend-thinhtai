import { ConflictException, Injectable } from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';
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
}
