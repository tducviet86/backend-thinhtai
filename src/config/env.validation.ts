import { plainToInstance, Type } from 'class-transformer';
import { IsIn, IsInt, IsString, IsUrl, Min, validateSync } from 'class-validator';

class Environment {
  @IsIn(['development', 'test', 'production']) NODE_ENV = 'development';
  @Type(() => Number) @IsInt() @Min(1) PORT = 3000;
  @IsString() DATABASE_URL!: string;
  @IsString() JWT_ACCESS_SECRET!: string;
  @IsString() JWT_REFRESH_SECRET!: string;
  @IsString() JWT_ACCESS_TTL = '15m';
  @IsString() JWT_REFRESH_TTL = '30d';
  @IsString() CORS_ORIGINS!: string;
  @IsUrl({ require_tld: false }) PUBLIC_BASE_URL!: string;
}
export function validateEnvironment(raw: Record<string, unknown>): Environment {
  const value = plainToInstance(Environment, { PORT: 3000, ...raw }, { enableImplicitConversion: true });
  const errors = validateSync(value, { skipMissingProperties: false });
  if (errors.length) throw new Error(`Invalid environment: ${errors.map((e) => e.property).join(', ')}`);
  if (value.JWT_ACCESS_SECRET.length < 32 || value.JWT_REFRESH_SECRET.length < 32) throw new Error('JWT secrets must be at least 32 characters');
  return value;
}
