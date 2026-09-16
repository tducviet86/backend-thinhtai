import { Body, Controller, Get, Post, Query, Req, Res, Version } from '@nestjs/common';
import { IsIn, IsString } from 'class-validator';
import { Request, Response } from 'express';
import { Public } from '../common/decorators/permissions.decorator';
import { VnpayService } from './vnpay.service';

class CreateVnpayPaymentDto { @IsString() bookingCode!: string; @IsIn(['vn', 'en']) locale: 'vn' | 'en' = 'vn'; }
@Controller('payments/vnpay')
export class VnpayController {
  constructor(private readonly service: VnpayService) {}
  @Post('create') @Version('1') create(@Body() dto: CreateVnpayPaymentDto, @Req() req: Request) { return this.service.createPaymentUrl(req.user!.sub, dto.bookingCode, req.ip || req.socket.remoteAddress || '127.0.0.1', dto.locale); }
  @Public() @Get('verify-return') @Version('1') verifyReturn(@Query() query: Record<string, unknown>) { return this.service.verifyReturn(query); }
  @Public() @Get('ipn') @Version('1') async ipn(@Query() query: Record<string, unknown>, @Res() response: Response) { response.status(200).json(await this.service.handleIpn(query)); }
}
