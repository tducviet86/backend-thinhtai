import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AdminService } from './admin.service';
import { BookingStateService } from '../bookings/booking-state.service';
import { PrismaService } from '../prisma/prisma.service';
import { AvailabilityService } from '../availability/availability.service';
import { PricingService } from '../pricing/pricing.service';
import { AuthUser } from '../auth/auth.types';

describe('Admin booking safety', () => {
  const actor: AuthUser = { sub: 'staff', email: 'staff@example.test', permissions: ['booking.update', 'booking.checkin', 'booking.checkout'], tokenVersion: 0 };
  const booking = { id: 'booking', unitId: 'unit', status: 'PENDING_PAYMENT', paidAmount: new Prisma.Decimal(0), depositRequired: new Prisma.Decimal(300), remainingAmount: new Prisma.Decimal(1000), checkIn: new Date('2026-01-01'), checkOut: new Date('2026-01-03') };
  let db: { $transaction: jest.Mock; booking: { findUniqueOrThrow: jest.Mock; update: jest.Mock }; payment: { findUnique: jest.Mock; create: jest.Mock }; auditLog: { create: jest.Mock } };
  let availability: { lockUnit: jest.Mock; assertAvailable: jest.Mock };
  let service: AdminService;
  beforeEach(() => {
    db = { $transaction: jest.fn(), booking: { findUniqueOrThrow: jest.fn().mockResolvedValue(booking), update: jest.fn() }, payment: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'payment' }) }, auditLog: { create: jest.fn() } };
    db.$transaction.mockImplementation(async callback => callback(db));
    availability = { lockUnit: jest.fn(), assertAvailable: jest.fn() };
    service = new AdminService(db as unknown as PrismaService, availability as unknown as AvailabilityService, {} as PricingService, new BookingStateService());
  });
  it('rejects customer accounts at the admin boundary', () => { expect(() => service.session({ ...actor, permissions: [] })).toThrow(ForbiddenException); });
  it('requires the specific action permission, not just a signed-in user', async () => { await expect(service.transition('booking', { status: 'CHECKED_IN', reason: 'Arrived' }, { ...actor, permissions: ['booking.read'] })).rejects.toThrow(ForbiddenException); expect(db.$transaction).not.toHaveBeenCalled(); });
  it('does not confirm before the required deposit is paid', async () => { await expect(service.transition('booking', { status: 'CONFIRMED', reason: 'Confirm' }, actor)).rejects.toThrow(BadRequestException); expect(db.booking.update).not.toHaveBeenCalled(); });
  it('does not check out a booking with unpaid balance', async () => { db.booking.findUniqueOrThrow.mockResolvedValue({ ...booking, status: 'CHECKED_IN' }); await expect(service.transition('booking', { status: 'CHECKED_OUT', reason: 'Departed' }, actor)).rejects.toThrow(BadRequestException); });
  it('checks availability under a unit lock when reactivating a booking', async () => { db.booking.findUniqueOrThrow.mockResolvedValue({ ...booking, status: 'PAYMENT_FAILED' }); await service.transition('booking', { status: 'PENDING_PAYMENT', reason: 'Retry' }, actor); expect(availability.lockUnit).toHaveBeenCalledWith(db, 'unit'); expect(availability.assertAvailable).toHaveBeenCalledWith(db, 'unit', booking.checkIn, booking.checkOut, 'booking'); expect(db.auditLog.create).toHaveBeenCalled(); });
  it('rejects overpayment without creating a payment', async () => { await expect(service.payment('booking', { amount: 1001, method: 'CASH', reference: 'receipt', requestId: 'request' }, 'staff')).rejects.toThrow(BadRequestException); expect(db.payment.create).not.toHaveBeenCalled(); });
  it('does not double-count a retried payment', async () => { const prior = { bookingId: 'booking', amount: new Prisma.Decimal(500), method: 'CASH' }; db.payment.findUnique.mockResolvedValue(prior); await expect(service.payment('booking', { amount: 500, method: 'CASH', reference: 'receipt', requestId: 'request' }, 'staff')).resolves.toEqual(prior); expect(db.payment.create).not.toHaveBeenCalled(); expect(db.booking.update).not.toHaveBeenCalled(); });
  it('records payment and balance together using serializable isolation', async () => { await service.payment('booking', { amount: 300, method: 'CASH', reference: 'receipt', requestId: 'request' }, 'staff'); const update = db.booking.update.mock.calls[0][0]; expect(update.data.paidAmount.toString()).toBe('300'); expect(update.data.remainingAmount.toString()).toBe('700'); expect(db.$transaction.mock.calls[0][1]).toEqual({ isolationLevel: 'Serializable' }); expect(db.auditLog.create).toHaveBeenCalled(); });
  it('forbids creating a role with permissions the actor does not hold', async () => { await expect(service.role({ code: 'SUPER_STAFF', name: 'Forbidden', permissions: ['staff.manage'] }, actor)).rejects.toThrow(ForbiddenException); });
});
