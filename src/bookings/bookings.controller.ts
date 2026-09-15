import { Body, Controller, Get, Param, Post, Req, Version } from '@nestjs/common';
import { Request } from 'express';
import { Public } from '../common/decorators/permissions.decorator';
import { BookingsService } from './bookings.service';
import { CreateBookingDto, CreateHoldDto } from './dto/create-booking.dto';
@Controller('bookings')
export class BookingsController {
  constructor(private readonly service: BookingsService) {}
  @Public() @Post('holds') @Version('1') hold(@Body() dto: CreateHoldDto) { return this.service.createHold(dto); }
  @Post() @Version('1') create(@Body() dto: CreateBookingDto, @Req() req: Request) { return this.service.create(dto, req.user!.sub); }
  @Public() @Get(':bookingCode') @Version('1') get(@Param('bookingCode') code: string) { return this.service.findPublic(code); }
}
