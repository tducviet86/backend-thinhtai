import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, PaymentStatus } from '@prisma/client';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

type VnpParams = Record<string, string>;

@Injectable()
export class VnpayService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  async createPaymentUrl(userId: string, bookingCode: string, ipAddress: string, locale: 'vn' | 'en') {
    const booking = await this.prisma.booking.findUnique({ where: { bookingCode }, include: { customer: { select: { userId: true } } } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.customer.userId !== userId) throw new ForbiddenException('Booking does not belong to this account');
    if (!['PENDING_PAYMENT', 'PAYMENT_FAILED'].includes(booking.status)) throw new BadRequestException('Booking is not awaiting payment');
    if (booking.currency !== 'VND') throw new BadRequestException('VNPAY only supports VND');
    const amount = Prisma.Decimal.min(booking.depositRequired, booking.remainingAmount);
    if (amount.lte(0)) throw new BadRequestException('Booking has no outstanding deposit');
    const existing = await this.prisma.payment.findUnique({
      where: { provider_providerReference: { provider: 'VNPAY', providerReference: booking.bookingCode } },
    });
    if (!existing) {
      await this.prisma.payment.create({ data: { bookingId: booking.id, type: 'DEPOSIT', method: 'VNPAY', provider: 'VNPAY', providerReference: booking.bookingCode, amount, currency: booking.currency, status: 'PENDING' } });
    } else if (existing.status === PaymentStatus.FAILED || existing.status === PaymentStatus.CANCELLED) {
      await this.prisma.payment.update({ where: { id: existing.id }, data: { amount, status: PaymentStatus.PENDING, paidAt: null } });
    }
    const now = new Date(), expires = new Date(now.valueOf() + 15 * 60_000);
    const params: VnpParams = {
      vnp_Version: '2.1.0', vnp_Command: 'pay', vnp_TmnCode: this.config.getOrThrow('VNPAY_TMN_CODE'),
      vnp_Amount: amount.mul(100).toFixed(0), vnp_CurrCode: 'VND', vnp_TxnRef: booking.bookingCode,
      vnp_OrderInfo: `Thanh toan dat coc booking ${booking.bookingCode}`, vnp_OrderType: 'other',
      vnp_Locale: locale, vnp_ReturnUrl: this.config.getOrThrow('VNPAY_RETURN_URL'),
      vnp_IpAddr: this.normalizeIp(ipAddress), vnp_CreateDate: this.formatVnpDate(now), vnp_ExpireDate: this.formatVnpDate(expires),
    };
    const query = this.canonicalQuery(params), secureHash = this.sign(query);
    return { paymentUrl: `${this.config.getOrThrow('VNPAY_URL')}?${query}&vnp_SecureHash=${secureHash}`, expiresAt: expires, bookingCode: booking.bookingCode, amount: amount.toFixed(2), currency: booking.currency };
  }

  verifyReturn(query: Record<string, unknown>) {
    const params = this.extract(query), secureHash = params.vnp_SecureHash ?? '';
    delete params.vnp_SecureHash; delete params.vnp_SecureHashType;
    const validSignature = this.safeEqual(this.sign(this.canonicalQuery(params)), secureHash);
    return { validSignature, success: validSignature && params.vnp_ResponseCode === '00' && params.vnp_TransactionStatus === '00', bookingCode: params.vnp_TxnRef ?? '', responseCode: params.vnp_ResponseCode ?? '', transactionNo: params.vnp_TransactionNo ?? '' };
  }

  async handleIpn(query: Record<string, unknown>): Promise<{ RspCode: string; Message: string }> {
    const params = this.extract(query), secureHash = params.vnp_SecureHash ?? '';
    delete params.vnp_SecureHash; delete params.vnp_SecureHashType;
    if (!this.safeEqual(this.sign(this.canonicalQuery(params)), secureHash)) return { RspCode: '97', Message: 'Invalid signature' };
    if (params.vnp_TmnCode !== this.config.getOrThrow('VNPAY_TMN_CODE')) return { RspCode: '97', Message: 'Invalid terminal code' };
    const booking = await this.prisma.booking.findUnique({ where: { bookingCode: params.vnp_TxnRef }, include: { payments: { where: { provider: 'VNPAY' }, orderBy: { createdAt: 'desc' }, take: 1 } } });
    if (!booking) return { RspCode: '01', Message: 'Order not found' };
    const payment = booking.payments[0];
    if (!payment) return { RspCode: '01', Message: 'Payment not found' };
    if (payment.status === 'PAID') return { RspCode: '02', Message: 'Order already confirmed' };
    const receivedAmount = new Prisma.Decimal(params.vnp_Amount || 0).div(100);
    if (!receivedAmount.equals(payment.amount)) return { RspCode: '04', Message: 'Invalid amount' };
    const success = params.vnp_ResponseCode === '00' && params.vnp_TransactionStatus === '00';
    const providerEventId = params.vnp_TransactionNo || createHash('sha256').update(this.canonicalQuery(params)).digest('hex');
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.paymentWebhookEvent.create({ data: { provider: 'VNPAY', providerEventId, payloadHash: createHash('sha256').update(this.canonicalQuery(params)).digest('hex'), processedAt: new Date() } });
        await tx.payment.update({ where: { id: payment.id }, data: { status: success ? 'PAID' : 'FAILED', paidAt: success ? new Date() : null } });
        if (success) {
          const aggregate = await tx.payment.aggregate({ where: { bookingId: booking.id, status: 'PAID' }, _sum: { amount: true } });
          const paidAmount = aggregate._sum.amount ?? new Prisma.Decimal(0);
          await tx.booking.update({ where: { id: booking.id }, data: { paidAmount, remainingAmount: Prisma.Decimal.max(booking.total.sub(paidAmount), 0), status: paidAmount.gte(booking.depositRequired) ? 'CONFIRMED' : booking.status } });
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return { RspCode: '02', Message: 'Order already confirmed' };
      return { RspCode: '99', Message: 'Unable to update payment' };
    }
    return { RspCode: '00', Message: 'Confirm Success' };
  }

  private extract(query: Record<string, unknown>): VnpParams { return Object.fromEntries(Object.entries(query).filter(([key, value]) => key.startsWith('vnp_') && typeof value === 'string')) as VnpParams; }
  private canonicalQuery(params: VnpParams): string { return Object.keys(params).sort().map((key) => `${this.encode(key)}=${this.encode(params[key])}`).join('&'); }
  private encode(value: string): string { return encodeURIComponent(value).replace(/%20/g, '+'); }
  private sign(value: string): string { return createHmac('sha512', this.config.getOrThrow<string>('VNPAY_HASH_SECRET')).update(value, 'utf8').digest('hex'); }
  private safeEqual(expected: string, actual: string): boolean { const left = Buffer.from(expected), right = Buffer.from(actual); return left.length === right.length && timingSafeEqual(left, right); }
  private normalizeIp(ip: string): string { return ip.replace(/^::ffff:/, '') || '127.0.0.1'; }
  private formatVnpDate(date: Date): string { const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).formatToParts(date); const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)!.value; return `${get('year')}${get('month')}${get('day')}${get('hour')}${get('minute')}${get('second')}`; }
}
