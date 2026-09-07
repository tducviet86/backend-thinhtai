import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
@Module({ imports: [JwtModule.registerAsync({ inject:[ConfigService], useFactory:(c:ConfigService)=>({ secret:c.getOrThrow<string>('JWT_ACCESS_SECRET'), signOptions:{ expiresIn: c.get<string>('JWT_ACCESS_TTL','15m') as never } }) })], controllers:[AuthController], providers:[AuthService], exports:[JwtModule] })
export class AuthModule {}
