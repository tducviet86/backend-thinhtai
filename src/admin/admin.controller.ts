import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { RequirePermissions as Can } from '../common/decorators/permissions.decorator';
import { AdminService } from './admin.service';
import { AdminBookingDto, EditUnitDto, CreateUnitDto, PropertyDto, BlockDto, CustomerDto, PaymentDto, RoleDto, StaffAccessDto, StaffDto, StayDto, TransitionDto } from './admin.dto';
@Controller({ path: 'admin', version: '1' })
export class AdminController {
  constructor(private readonly service: AdminService) {}
  @Get('session') session(@Req() req: Request) { return this.service.session(req.user!); }
  @Get('dashboard') @Can('report.read') dashboard() { return this.service.dashboard(); }
  @Get('bookings') @Can('booking.read') bookings() { return this.service.bookings(); }
  @Post('quote') @Can('booking.create') quote(@Body() dto: StayDto) { return this.service.quote(dto); }
  @Post('bookings') @Can('booking.create') create(@Body() dto: AdminBookingDto, @Req() req: Request) { return this.service.createBooking(dto, req.user!.sub); }
  @Patch('bookings/:id/status') status(@Param('id', ParseUUIDPipe) id: string, @Body() dto: TransitionDto, @Req() req: Request) { return this.service.transition(id, dto, req.user!); }
  @Post('bookings/:id/payments') @Can('payment.confirm') payment(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PaymentDto, @Req() req: Request) { return this.service.payment(id, dto, req.user!.sub); }
  @Get('customers') @Can('customer.read') customers() { return this.service.customers(); }
  @Post('customers') @Can('customer.create') customer(@Body() dto: CustomerDto, @Req() req: Request) { return this.service.customer(dto, req.user!.sub); }
  @Patch('customers/:id') @Can('customer.update') updateCustomer(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CustomerDto, @Req() req: Request) { return this.service.customer(dto, req.user!.sub, id); }
  @Get('amenities') @Can('unit.read') amenities() { return this.service.amenities(); }
  @Get('units') @Can('unit.read') units() { return this.service.units(); }
  @Patch('units/:id') @Can('unit.update', 'pricing.update', 'unit.publish') unit(@Param('id', ParseUUIDPipe) id: string, @Body() dto: EditUnitDto, @Req() req: Request) { return this.service.unit(id, dto, req.user!.sub); }
  @Post('units') @Can('unit.create', 'pricing.update', 'unit.publish') createUnit(@Body() dto: CreateUnitDto, @Req() req: Request) { return this.service.createUnit(dto, req.user!.sub); }
  @Get('locations') @Can('property.read') locations() { return this.service.locations(); }
  @Post('properties') @Can('property.create', 'property.publish') createProperty(@Body() dto: PropertyDto, @Req() req: Request) { return this.service.property(dto, req.user!.sub); }
  @Patch('properties/:id') @Can('property.update', 'property.publish') updateProperty(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PropertyDto, @Req() req: Request) { return this.service.property(dto, req.user!.sub, id); }
  @Get('properties') @Can('property.read') properties() { return this.service.properties(); }
  @Get('calendar') @Can('availability.read') calendar() { return this.service.calendar(); }
  @Post('blocks') @Can('availability.update') block(@Body() dto: BlockDto, @Req() req: Request) { return this.service.block(dto, req.user!.sub); }
  @Delete('blocks/:id') @Can('availability.update') unblock(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) { return this.service.unblock(id, req.user!.sub); }
  @Get('payments') @Can('payment.read') payments() { return this.service.payments(); }
  @Get('staff') @Can('staff.manage') staff() { return this.service.staff(); }
  @Post('staff') @Can('staff.manage') createStaff(@Body() dto: StaffDto, @Req() req: Request) { return this.service.createStaff(dto, req.user!); }
  @Patch('staff/:id') @Can('staff.manage') access(@Param('id', ParseUUIDPipe) id: string, @Body() dto: StaffAccessDto, @Req() req: Request) { return this.service.access(id, dto, req.user!); }
  @Post('roles') @Can('staff.manage') role(@Body() dto: RoleDto, @Req() req: Request) { return this.service.role(dto, req.user!); }
  @Get('audit') @Can('staff.manage') audit() { return this.service.audit(); }
}
