import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsString, IsUUID, Max, Min, ValidateIf } from 'class-validator';
export class QuoteDto {
  @ApiPropertyOptional() @ValidateIf((o: QuoteDto) => !o.publicCode) @IsUUID() unitId?: string;
  @ApiPropertyOptional() @ValidateIf((o: QuoteDto) => !o.unitId) @IsString() publicCode?: string;
  @ApiProperty() @IsDateString({ strict: true }) checkIn!: string;
  @ApiProperty() @IsDateString({ strict: true }) checkOut!: string;
  @ApiProperty() @IsInt() @Min(1) @Max(50) guests!: number;
  @IsOptional() @IsString() promoCode?: string;
}
