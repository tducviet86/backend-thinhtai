import { Body, Controller, Get, Patch, Post, Req, Version } from '@nestjs/common';
import { Request } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/permissions.decorator';
import { AuthService } from './auth.service';
import { LoginDto, RefreshDto } from './dto/login.dto';
import { RegisterDto, UpdateCustomerProfileDto } from './dto/customer-auth.dto';
@ApiTags('auth') @Controller('auth')
export class AuthController {
  constructor(private readonly service: AuthService) {}
  @Public() @Post('login') @Version('1') login(@Body() dto: LoginDto) { return this.service.login(dto.email, dto.password); }
  @Public() @Post('customer-login') @Version('1') customerLogin(@Body() dto: LoginDto) { return this.service.login(dto.email, dto.password, true); }
  @Public() @Post('register') @Version('1') register(@Body() dto: RegisterDto) { return this.service.register(dto); }
  @Public() @Post('refresh') @Version('1') refresh(@Body() dto: RefreshDto) { return this.service.refresh(dto.refreshToken); }
  @Get('me') @Version('1') me(@Req() req: Request) { return this.service.me(req.user!.sub); }
  @Patch('profile') @Version('1') profile(@Req() req: Request, @Body() dto: UpdateCustomerProfileDto) { return this.service.updateProfile(req.user!.sub, dto); }
}
