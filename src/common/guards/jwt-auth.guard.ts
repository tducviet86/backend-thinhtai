import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AuthUser } from '../../auth/auth.types';
import { PrismaService } from '../../prisma/prisma.service';
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly jwt: JwtService, private readonly prisma: PrismaService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>('public', [context.getHandler(), context.getClass()])) return true;
    const req = context.switchToHttp().getRequest<Request>();
    const [kind, token] = req.headers.authorization?.split(' ') ?? [];
    if (kind !== 'Bearer' || !token) throw new UnauthorizedException('Bearer token required');
    try {
      const payload = await this.jwt.verifyAsync<AuthUser>(token);
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, select: { status: true, tokenVersion: true } });
      if (!user || user.status !== 'ACTIVE' || user.tokenVersion !== payload.tokenVersion) throw new Error('revoked');
      req.user = payload;
      return true;
    }
    catch { throw new UnauthorizedException('Invalid or expired token'); }
  }
}
