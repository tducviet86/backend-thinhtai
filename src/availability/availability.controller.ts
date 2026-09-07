import { Controller, Get, Query, Version } from '@nestjs/common';
import { IsDateString, IsUUID } from 'class-validator';
import { Public } from '../common/decorators/permissions.decorator';
import { parseStay } from '../common/date-interval';
import { AvailabilityService } from './availability.service';
class AvailabilityQuery { @IsUUID() unitId!:string; @IsDateString({strict:true}) checkIn!:string; @IsDateString({strict:true}) checkOut!:string }
@Controller('availability') export class AvailabilityController { constructor(private readonly service:AvailabilityService){} @Public() @Get() @Version('1') async get(@Query() q:AvailabilityQuery){const {start,end}=parseStay(q.checkIn,q.checkOut); return {available:await this.service.isAvailable(q.unitId,start,end),checkIn:q.checkIn,checkOut:q.checkOut};} }
