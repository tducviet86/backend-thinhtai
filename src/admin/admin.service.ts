import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import { AuthUser } from '../auth/auth.types';
import { AvailabilityService } from '../availability/availability.service';
import { BookingStateService } from '../bookings/booking-state.service';
import { parseStay } from '../common/date-interval';
import { PricingService } from '../pricing/pricing.service';
import { PrismaService } from '../prisma/prisma.service';
import { AdminBookingDto, CreateUnitDto, PropertyDto, BlockDto, CustomerDto, PaymentDto, RoleDto, StaffAccessDto, StaffDto, StayDto, TransitionDto, UnitDto } from './admin.dto';
const bookingInclude = { customer: true, unit: { select: { id: true, nameVi: true, publicCode: true } }, payments: { orderBy: { createdAt: 'desc' as const } } };
@Injectable()
export class AdminService {
  constructor(private readonly db: PrismaService, private readonly availability: AvailabilityService, private readonly pricing: PricingService, private readonly states: BookingStateService) {}
  private log(tx: Prisma.TransactionClient, actor: string, action: string, entityType: string, entityId: string, metadata?: Prisma.InputJsonObject) {
    return tx.auditLog.create({ data: { actorUserId: actor, action, entityType, entityId, metadata } });
  }
  session(user: AuthUser) {
    if (!user.permissions.length) throw new ForbiddenException('Tài khoản không có quyền quản trị.');
    return { id: user.sub, email: user.email, permissions: user.permissions };
  }
  async dashboard() {
    const today = new Date(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()) + 'T00:00:00Z');
    const month = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const next = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));
    const [bookings, units, occupied, revenue, arrivals, departures, pending] = await Promise.all([
      this.db.booking.count({ where: { createdAt: { gte: month, lt: next } } }), this.db.unit.count({ where: { status: 'PUBLISHED' } }),
      this.db.booking.findMany({ where: { status: { in: ['CONFIRMED', 'CHECKED_IN'] }, checkIn: { lte: today }, checkOut: { gt: today }, unit: { status: 'PUBLISHED' } }, distinct: ['unitId'], select: { unitId: true } }),
      this.db.payment.groupBy({ by: ['currency'], where: { status: 'PAID', paidAt: { gte: month, lt: next }, type: { not: 'REFUND' } }, _sum: { amount: true } }),
      this.db.booking.findMany({ where: { checkIn: today, status: { in: ['CONFIRMED', 'CHECKED_IN'] } }, include: bookingInclude }),
      this.db.booking.findMany({ where: { checkOut: today, status: { in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] } }, include: bookingInclude }),
      this.db.booking.count({ where: { status: 'PENDING_PAYMENT' } }),
    ]);
    return { bookings, units, occupied: occupied.length, revenue, arrivals, departures, pending, today, month };
  }
  bookings() { return this.db.booking.findMany({ orderBy: { createdAt: 'desc' }, take: 1000, include: bookingInclude }); }
  quote(dto: StayDto) { return this.pricing.quote({ ...dto, guests: dto.guestCount }); }
  async createBooking(dto: AdminBookingDto, actor: string) {
    const { start, end } = parseStay(dto.checkIn, dto.checkOut);
    const calculated = await this.quote(dto);
    const quote = await this.db.priceQuote.findUnique({ where: { id: dto.quoteId } });
    if (!quote || quote.expiresAt <= new Date() || quote.unitId !== dto.unitId || +quote.checkIn !== +start || +quote.checkOut !== +end || quote.guests !== dto.guestCount || !quote.total.equals(calculated.total)) throw new ConflictException('Báo giá đã thay đổi. Vui lòng tính giá lại.');
    return this.db.$transaction(async tx => {
      await this.availability.lockUnit(tx, dto.unitId);
      const unit = await tx.unit.findUniqueOrThrow({ where: { id: dto.unitId } });
      if (unit.status !== 'PUBLISHED') throw new BadRequestException('Căn hộ chưa mở bán.');
      await this.availability.assertAvailable(tx, dto.unitId, start, end);
      const b = await tx.booking.create({ data: { bookingCode: `TT-${new Date().getUTCFullYear()}-${randomBytes(6).toString('hex').toUpperCase()}`, customerId: dto.customerId, unitId: dto.unitId, source: dto.source, checkIn: start, checkOut: end, guestCount: dto.guestCount, status: 'PENDING_PAYMENT', currency: quote.currency, subtotal: quote.subtotal, fees: quote.cleaningFee.add(quote.serviceFee), discount: quote.discount, total: quote.total, depositRequired: quote.requiredDeposit, remainingAmount: quote.total, createdByUserId: actor } });
      await this.log(tx, actor, 'booking.create', 'Booking', b.id); return b;
    }, { isolationLevel: 'Serializable' });
  }
  async transition(id: string, dto: TransitionDto, user: AuthUser) {
    const permission = dto.status.startsWith('CANCELLED') ? 'booking.cancel' : dto.status === 'CHECKED_IN' ? 'booking.checkin' : ['CHECKED_OUT', 'COMPLETED'].includes(dto.status) ? 'booking.checkout' : 'booking.update';
    if (!user.permissions.includes(permission)) throw new ForbiddenException('Bạn không có quyền thực hiện thao tác này.');
    return this.db.$transaction(async tx => {
      const b = await tx.booking.findUniqueOrThrow({ where: { id } });
      this.states.assert(b.status, dto.status);
      if (['CONFIRMED', 'CHECKED_IN'].includes(dto.status) && b.paidAmount.lt(b.depositRequired)) throw new BadRequestException('Cần thu đủ tiền cọc trước khi xác nhận / nhận phòng.');
      if (dto.status === 'CHECKED_OUT' && b.remainingAmount.gt(0)) throw new BadRequestException('Vui lòng thu đủ số tiền còn lại trước khi trả phòng.');
      if (dto.status === 'CHECKED_IN' && b.checkIn.toISOString().slice(0, 10) > new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())) throw new BadRequestException('Chưa đến ngày nhận phòng.');
      if (['PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN'].includes(dto.status)) {
        await this.availability.lockUnit(tx, b.unitId);
        await this.availability.assertAvailable(tx, b.unitId, b.checkIn, b.checkOut, b.id);
      }
      const result = await tx.booking.update({ where: { id }, data: { status: dto.status } });
      await this.log(tx, user.sub, permission, 'Booking', id, { from: b.status, to: dto.status, reason: dto.reason }); return result;
    }, { isolationLevel: 'Serializable' });
  }
  async payment(id: string, dto: PaymentDto, actor: string) {
    return this.db.$transaction(async tx => {
      const prior = await tx.payment.findUnique({ where: { provider_providerReference: { provider: 'ADMIN', providerReference: dto.requestId } } });
      if (prior) { if (prior.bookingId !== id || !prior.amount.equals(dto.amount) || prior.method !== dto.method) throw new ConflictException('Mã giao dịch đã được sử dụng.'); return prior; }
      const b = await tx.booking.findUniqueOrThrow({ where: { id } });
      if (!['PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN'].includes(b.status)) throw new BadRequestException('Booking không còn nhận thanh toán.');
      if (new Prisma.Decimal(dto.amount).gt(b.remainingAmount)) throw new BadRequestException('Số tiền vượt quá công nợ.');
      const p = await tx.payment.create({ data: { bookingId: id, amount: dto.amount, currency: b.currency, type: b.paidAmount.isZero() ? 'DEPOSIT' : 'BALANCE', method: dto.method, provider: 'ADMIN', providerReference: dto.requestId, status: 'PAID', paidAt: new Date() } });
      await tx.booking.update({ where: { id }, data: { paidAmount: b.paidAmount.add(dto.amount), remainingAmount: b.remainingAmount.sub(dto.amount) } });
      await this.log(tx, actor, 'payment.confirm', 'Payment', p.id, { reference: dto.reference, amount: dto.amount, bookingId: id }); return p;
    }, { isolationLevel: 'Serializable' });
  }
  customers() { return this.db.customer.findMany({ orderBy: { createdAt: 'desc' }, take: 1000, include: { _count: { select: { bookings: true } } } }); }
  customer(dto: CustomerDto, actor: string, id?: string) { return this.db.$transaction(async tx => { const c = id ? await tx.customer.update({ where: { id }, data: dto }) : await tx.customer.create({ data: dto }); await this.log(tx, actor, id ? 'customer.update' : 'customer.create', 'Customer', c.id); return c; }); }
  units() { return this.db.unit.findMany({ orderBy: { publicCode: 'asc' }, include: { property: { select: { name: true } } } }); }
  unit(id: string, dto: UnitDto, actor: string) { return this.db.$transaction(async tx => { const u = await tx.unit.update({ where: { id }, data: dto }); await this.log(tx, actor, 'unit.update', 'Unit', id, { ...dto }); return u; }); }
  async createUnit(dto: CreateUnitDto, actor: string) {
    if (await this.db.unit.findUnique({ where: { publicCode: dto.publicCode } })) throw new ConflictException('Mã căn hộ đã tồn tại.');
    const slug = `apartment-${randomBytes(6).toString('hex')}`;
    return this.db.$transaction(async tx => {
      const u = await tx.unit.create({ data: { ...dto, internalCode: dto.publicCode, nameEn: dto.nameVi, slugVi: slug, slugEn: slug, descriptionVi: dto.nameVi, descriptionEn: dto.nameVi, publishedAt: dto.status === 'PUBLISHED' ? new Date() : null } });
      await this.log(tx, actor, 'unit.create', 'Unit', u.id); return u;
    });
  }
  locations() { return this.db.location.findMany({ select: { id: true, nameVi: true, type: true }, orderBy: { nameVi: 'asc' } }); }
  property(dto: PropertyDto, actor: string, id?: string) {
    return this.db.$transaction(async tx => {
      const slug = `property-${randomBytes(6).toString('hex')}`;
      const p = id ? await tx.property.update({ where: { id }, data: dto }) : await tx.property.create({ data: { ...dto, slugVi: slug, slugEn: slug, descriptionVi: dto.name, descriptionEn: dto.name, publishedAt: dto.status === 'ACTIVE' ? new Date() : null } });
      await this.log(tx, actor, id ? 'property.update' : 'property.create', 'Property', p.id); return p;
    });
  }
  properties() { return this.db.property.findMany({ include: { _count: { select: { units: true } } } }); }
  async calendar() {
    const [units, bookings, blocks, holds] = await Promise.all([
      this.db.unit.findMany({ select: { id: true, publicCode: true, nameVi: true, status: true } }),
      this.db.booking.findMany({ where: { status: { in: ['PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN'] } }, select: { id: true, unitId: true, bookingCode: true, checkIn: true, checkOut: true, status: true } }),
      this.db.availabilityBlock.findMany({ where: { state: { in: ['BLOCKED', 'MAINTENANCE'] } } }),
      this.db.hold.findMany({ where: { status: 'ACTIVE', expiresAt: { gt: new Date() } }, select: { id: true, unitId: true, startDate: true, endDate: true } }),
    ]); return { units, bookings, blocks, holds };
  }
  block(dto: BlockDto, actor: string) { const { start, end } = parseStay(dto.checkIn, dto.checkOut); return this.db.$transaction(async tx => { await this.availability.lockUnit(tx, dto.unitId); await this.availability.assertAvailable(tx, dto.unitId, start, end); const b = await tx.availabilityBlock.create({ data: { unitId: dto.unitId, startDate: start, endDate: end, state: dto.state, reason: dto.reason, createdByUserId: actor } }); await this.log(tx, actor, 'availability.block', 'AvailabilityBlock', b.id, { reason: dto.reason }); return b; }, { isolationLevel: 'Serializable' }); }
  unblock(id: string, actor: string) { return this.db.$transaction(async tx => { const b = await tx.availabilityBlock.delete({ where: { id } }); await this.log(tx, actor, 'availability.unblock', 'AvailabilityBlock', id, { reason: b.reason }); return { deleted: true }; }); }
  payments() { return this.db.payment.findMany({ orderBy: { createdAt: 'desc' }, take: 1000, include: { booking: { select: { bookingCode: true } } } }); }
  async staff() { const [users, roles, permissions] = await Promise.all([this.db.user.findMany({ where: { roles: { some: {} } }, select: { id: true, email: true, firstName: true, lastName: true, status: true, roles: { include: { role: true } } } }), this.db.role.findMany({ include: { permissions: { include: { permission: true } } } }), this.db.permission.findMany({ orderBy: { code: 'asc' } })]); return { users, roles, permissions }; }
  private async assignable(roleId: string, user: AuthUser) {
    const role = await this.db.role.findUnique({ where: { id: roleId }, include: { permissions: { include: { permission: true } } } });
    if (!role) throw new NotFoundException('Vai trò không tồn tại.');
    if (role.code === 'ADMIN_OWNER' || role.permissions.some(p => !user.permissions.includes(p.permission.code))) throw new ForbiddenException('Không thể cấp quyền cao hơn quyền hiện tại hoặc gán vai trò chủ sở hữu.');
    return role;
  }
  async createStaff(dto: StaffDto, user: AuthUser) { await this.assignable(dto.roleId, user); if (await this.db.user.findUnique({ where: { email: dto.email.toLowerCase() } })) throw new ConflictException('Email đã tồn tại.'); const passwordHash = await argon2.hash(dto.password); return this.db.$transaction(async tx => { const u = await tx.user.create({ data: { email: dto.email.toLowerCase(), firstName: dto.firstName, lastName: dto.lastName, passwordHash, roles: { create: { roleId: dto.roleId } } }, select: { id: true, email: true } }); await this.log(tx, user.sub, 'staff.create', 'User', u.id); return u; }); }
  async access(id: string, dto: StaffAccessDto, user: AuthUser) {
    await this.assignable(dto.roleId, user);
    return this.db.$transaction(async tx => {
      const target = await tx.user.findUnique({ where: { id }, include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } } });
      if (!target) throw new NotFoundException();
      if (id === user.sub || target.roles.some(r => r.role.code === 'ADMIN_OWNER' || r.role.permissions.some(p => !user.permissions.includes(p.permission.code)))) throw new ForbiddenException('Không thể thay đổi tài khoản này.');
      await tx.userRole.deleteMany({ where: { userId: id } });
      await tx.userRole.create({ data: { userId: id, roleId: dto.roleId } });
      await tx.user.update({ where: { id }, data: { status: dto.status, tokenVersion: { increment: 1 } } });
      await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      await this.log(tx, user.sub, 'staff.access', 'User', id, { ...dto }); return { updated: true };
    }, { isolationLevel: 'Serializable' });
  }
  async role(dto: RoleDto, user: AuthUser) {
    if (dto.code === 'ADMIN_OWNER' || dto.permissions.some(p => !user.permissions.includes(p))) throw new ForbiddenException('Không thể cấp quyền ngoài phạm vi hiện tại.');
    const permissions = await this.db.permission.findMany({ where: { code: { in: dto.permissions } } });
    if (permissions.length !== dto.permissions.length || !permissions.length) throw new BadRequestException('Chọn ít nhất một quyền hợp lệ.');
    if (await this.db.role.findUnique({ where: { code: dto.code } })) throw new ConflictException('Mã vai trò đã tồn tại.');
    return this.db.$transaction(async tx => { const r = await tx.role.create({ data: { code: dto.code, name: dto.name, permissions: { create: permissions.map(p => ({ permissionId: p.id })) } } }); await this.log(tx, user.sub, 'role.create', 'Role', r.id, { permissions: dto.permissions }); return r; });
  }
  audit() { return this.db.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 500 }); }
}
