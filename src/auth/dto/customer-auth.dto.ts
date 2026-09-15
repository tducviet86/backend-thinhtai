import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty() @IsString() @MinLength(8) @MaxLength(128) password!: string;
}

export class UpdateCustomerProfileDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(80) firstName!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(80) lastName!: string;
  @ApiProperty() @IsString() @Matches(/^\+?[0-9][0-9\s.-]{7,19}$/) phone!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) nationality?: string;
}
