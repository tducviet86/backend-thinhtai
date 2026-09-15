import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingSource } from '@prisma/client';
import { IsDateString, IsEnum, IsInt, IsString, IsUUID, Max, Min, ValidateIf } from 'class-validator';
class PublicUnitIdentifier { @ApiPropertyOptional() @ValidateIf((o: PublicUnitIdentifier) => !o.publicCode) @IsUUID() unitId?: string; @ApiPropertyOptional() @ValidateIf((o: PublicUnitIdentifier) => !o.unitId) @IsString() publicCode?: string }
export class CreateBookingDto extends PublicUnitIdentifier {
  @ApiProperty() @IsUUID() quoteId!: string; @ApiProperty() @IsDateString({ strict: true }) checkIn!: string; @ApiProperty() @IsDateString({ strict: true }) checkOut!: string;
  @ApiProperty() @IsInt() @Min(1) @Max(50) guestCount!: number; @ApiProperty({ enum: BookingSource }) @IsEnum(BookingSource) source: BookingSource = 'WEBSITE';
}
export class CreateHoldDto extends PublicUnitIdentifier { @IsDateString({ strict: true }) checkIn!: string; @IsDateString({ strict: true }) checkOut!: string }
