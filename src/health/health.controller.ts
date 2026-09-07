import { Controller, Get, Version } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../common/decorators/permissions.decorator';
@Public() @Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}
  @Get('live') @Version('1') live() { return { status: 'ok' }; }
  @Get('ready') @Version('1') async ready() { await this.prisma.$queryRaw`SELECT 1`; return { status: 'ready' }; }
}
export class HealthModule {}
