import { BadRequestException, Controller, Get, Query, Version } from '@nestjs/common';
import { IsDateString, IsString, IsUUID } from 'class-validator';
import { Public } from '../common/decorators/permissions.decorator';
import { parseStay } from '../common/date-interval';
import { AvailabilityService } from './availability.service';
class AvailabilityQuery { @IsUUID() unitId!:string; @IsDateString({strict:true}) checkIn!:string; @IsDateString({strict:true}) checkOut!:string }
class AvailabilityCalendarQuery { @IsString() publicCode!: string; @IsDateString({strict:true}) from!: string; @IsDateString({strict:true}) to!: string }
@Controller('availability') export class AvailabilityController {
  constructor(private readonly service:AvailabilityService){}
  @Public() @Get('calendar') @Version('1') async calendar(@Query() q: AvailabilityCalendarQuery) {
    const { start, end } = parseStay(q.from, q.to);
    if ((end.valueOf() - start.valueOf()) / 86400000 > 93) throw new BadRequestException('Calendar range cannot exceed 93 days');
    return { publicCode: q.publicCode, from: q.from, to: q.to, unavailableNights: await this.service.unavailableNights(q.publicCode, start, end) };
  }
  @Public() @Get() @Version('1') async get(@Query() q:AvailabilityQuery){const {start,end}=parseStay(q.checkIn,q.checkOut); return {available:await this.service.isAvailable(q.unitId,start,end),checkIn:q.checkIn,checkOut:q.checkOut};}
}
