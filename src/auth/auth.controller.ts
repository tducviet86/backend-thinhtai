import { Body, Controller, Post, Version } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/permissions.decorator';
import { AuthService } from './auth.service';
import { LoginDto, RefreshDto } from './dto/login.dto';
@ApiTags('auth') @Controller('auth')
export class AuthController {
  constructor(private readonly service: AuthService) {}
  @Public() @Post('login') @Version('1') login(@Body() dto: LoginDto) { return this.service.login(dto.email, dto.password); }
  @Public() @Post('refresh') @Version('1') refresh(@Body() dto: RefreshDto) { return this.service.refresh(dto.refreshToken); }
}
