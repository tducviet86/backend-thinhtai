import { Transform } from 'class-transformer';
import { BookingSource, BookingStatus, UnitStatus, UserStatus } from '@prisma/client';
import { ArrayUnique, IsArray, IsEmail, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
export class CustomerDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value) @IsString() @Length(1, 80) firstName!: string;
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value) @IsString() @Length(1, 80) lastName!: string;
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value) @IsString() @Length(5, 30) phone!: string;
  @IsOptional() @IsEmail() email?: string | null;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}
export class StayDto {
  @IsUUID() unitId!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) checkIn!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) checkOut!: string;
  @IsInt() @Min(1) @Max(100) guestCount!: number;
}
export class AdminBookingDto extends StayDto {
  @IsUUID() customerId!: string;
  @IsEnum(BookingSource) source!: BookingSource;
  @IsUUID() quoteId!: string;
}
export class TransitionDto {
  @IsEnum(BookingStatus) status!: BookingStatus;
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value) @IsString() @Length(3, 500) reason!: string;
}
export class PaymentDto {
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(9999999999) amount!: number;
  @IsIn(['CASH', 'BANK_TRANSFER']) method!: string;
  @IsUUID() requestId!: string;
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value) @IsString() @Length(3, 200) reference!: string;
}
export class BlockDto {
  @IsUUID() unitId!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) checkIn!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) checkOut!: string;
  @IsIn(['BLOCKED', 'MAINTENANCE']) state!: 'BLOCKED' | 'MAINTENANCE';
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value) @IsString() @Length(3, 500) reason!: string;
}
export class UnitDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value) @IsString() @Length(1, 150) nameVi!: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(9999999999) basePrice!: number;
  @IsInt() @Min(1) @Max(100) maxGuests!: number;
  @IsEnum(UnitStatus) status!: UnitStatus;
}
export class StaffDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(12) @MaxLength(128) password!: string;
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value) @IsString() @Length(1, 80) firstName!: string;
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value) @IsString() @Length(1, 80) lastName!: string;
  @IsUUID() roleId!: string;
}
export class StaffAccessDto {
  @IsUUID() roleId!: string;
  @IsEnum(UserStatus) status!: UserStatus;
}
export class RoleDto {
  @Matches(/^[A-Z][A-Z0-9_]{2,39}$/) code!: string;
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value) @IsString() @Length(1, 100) name!: string;
  @IsArray() @ArrayUnique() @IsString({ each: true }) permissions!: string[];
}
export class CreateUnitDto extends UnitDto {
  @IsUUID() propertyId!: string;
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value) @IsString() @Length(2, 40) publicCode!: string;
  @IsInt() @Min(0) @Max(50) bedroomCount!: number;
  @IsNumber({ maxDecimalPlaces: 1 }) @Min(1) @Max(50) bathroomCount!: number;
  @IsInt() @Min(1) @Max(100) bedCount!: number;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) @Max(10000) area!: number;
  @IsIn(['VND', 'USD']) currency!: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(9999999999) cleaningFee!: number;
  @IsNumber({ maxDecimalPlaces: 4 }) @Min(0) @Max(1) serviceFeeRate!: number;
  @IsNumber({ maxDecimalPlaces: 4 }) @Min(0) @Max(1) depositRate!: number;
}
export class PropertyDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value) @IsString() @Length(2, 150) name!: string;
  @IsUUID() locationId!: string;
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value) @IsString() @Length(5, 300) address!: string;
  @IsNumber() @Min(-90) @Max(90) latitude!: number;
  @IsNumber() @Min(-180) @Max(180) longitude!: number;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) checkInTime!: string;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) checkOutTime!: string;
  @IsIn(['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED']) status!: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
}
