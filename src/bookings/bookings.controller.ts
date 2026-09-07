import { Body, Controller, Get, Param, Post, Version } from '@nestjs/common';
import { Public } from '../common/decorators/permissions.decorator';
import { BookingsService } from './bookings.service';
import { CreateBookingDto, CreateHoldDto } from './dto/create-booking.dto';
@Controller('bookings')
export class BookingsController {
  constructor(private readonly service: BookingsService) {}
  @Public() @Post('holds') @Version('1') hold(@Body() dto: CreateHoldDto) { return this.service.createHold(dto); }
  @Public() @Post() @Version('1') create(@Body() dto: CreateBookingDto) { return this.service.create(dto); }
  @Public() @Get(':bookingCode') @Version('1') get(@Param('bookingCode') code: string) { return this.service.findPublic(code); }
}
