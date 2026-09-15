import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCustomerProfileDto } from './dto/customer-auth.dto';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService, private readonly config: ConfigService) {}
  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() }, include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } } });
    if (!user || user.status !== 'ACTIVE' || !(await argon2.verify(user.passwordHash, password))) throw new UnauthorizedException('Invalid credentials');
    return this.issue(user.id, user.email, user.tokenVersion, [...new Set(user.roles.flatMap((r) => r.role.permissions.map((p) => p.permission.code)))]);
  }
  async register(email: string, password: string) {
    const normalizedEmail = email.toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } })) throw new ConflictException('Email is already registered');
    const user = await this.prisma.user.create({ data: { email: normalizedEmail, passwordHash: await argon2.hash(password), firstName: '', lastName: '' } });
    return this.issue(user.id, user.email, user.tokenVersion, []);
  }
  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, firstName: true, lastName: true, customer: { select: { phone: true, nationality: true } } } });
    if (!user) throw new UnauthorizedException('User not found');
    return { email: user.email, firstName: user.firstName, lastName: user.lastName, phone: user.customer?.phone ?? '', nationality: user.customer?.nationality ?? '', profileComplete: Boolean(user.firstName && user.lastName && user.customer?.phone) };
  }
  async updateProfile(userId: string, dto: UpdateCustomerProfileDto) {
    const user = await this.prisma.user.update({ where: { id: userId }, data: { firstName: dto.firstName.trim(), lastName: dto.lastName.trim(), customer: { upsert: { create: { firstName: dto.firstName.trim(), lastName: dto.lastName.trim(), email: undefined, phone: dto.phone.trim(), nationality: dto.nationality?.trim() }, update: { firstName: dto.firstName.trim(), lastName: dto.lastName.trim(), phone: dto.phone.trim(), nationality: dto.nationality?.trim() } } } }, select: { email: true, firstName: true, lastName: true, customer: { select: { phone: true, nationality: true } } } });
    await this.prisma.customer.update({ where: { userId }, data: { email: user.email } });
    return { email: user.email, firstName: user.firstName, lastName: user.lastName, phone: user.customer!.phone, nationality: user.customer!.nationality ?? '', profileComplete: true };
  }
  private async issue(id: string, email: string, tokenVersion: number, permissions: string[]) {
    const payload = { sub: id, email, tokenVersion, permissions };
    const accessToken = await this.jwt.signAsync(payload);
    const raw = randomBytes(48).toString('base64url');
    const hash = createHash('sha256').update(raw).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 86400000);
    await this.prisma.refreshToken.create({ data: { userId: id, tokenHash: hash, expiresAt } });
    return { accessToken, refreshToken: raw, expiresAt };
  }
  async refresh(raw: string) {
    const hash = createHash('sha256').update(raw).digest('hex');
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash: hash }, include: { user: { include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } } } } });
    if (!stored || stored.revokedAt || stored.expiresAt <= new Date() || stored.user.status !== 'ACTIVE') throw new UnauthorizedException('Refresh token is invalid');
    const next = await this.issue(stored.user.id, stored.user.email, stored.user.tokenVersion, [...new Set(stored.user.roles.flatMap((r) => r.role.permissions.map((p) => p.permission.code)))]);
    await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    return next;
  }
}
