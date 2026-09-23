import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
jest.mock('argon2', () => ({ verify: jest.fn().mockResolvedValue(true) }));
describe('Customer login boundary', () => {
  it('rejects staff credentials at customer login before issuing tokens', async () => {
    const jwt = { signAsync: jest.fn() };
    const db = { user: { findUnique: jest.fn().mockResolvedValue({ id: 'owner', status: 'ACTIVE', passwordHash: 'hash', roles: [{ role: { permissions: [] } }] }) } };
    const auth = new AuthService(db as unknown as PrismaService, jwt as unknown as JwtService, {} as ConfigService);
    await expect(auth.login('admin@example.test', 'password', true)).rejects.toThrow(ForbiddenException);
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });
});
