import { BadRequestException, Controller, Get, NotFoundException, Param, Query, Version } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsDateString, IsInt, IsOptional, Max, Min } from "class-validator";
import { AvailabilityState, BookingStatus, HoldStatus } from "@prisma/client";
import { Public } from "../common/decorators/permissions.decorator";
import { parseStay } from "../common/date-interval";
import { PrismaService } from "../prisma/prisma.service";

class UnitQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) guests?: number;
  @IsOptional() @IsDateString({ strict: true }) checkIn?: string;
  @IsOptional() @IsDateString({ strict: true }) checkOut?: string;
}

const publicSelect = {
  publicCode: true, nameVi: true, nameEn: true, slugVi: true, slugEn: true,
  descriptionVi: true, descriptionEn: true, bedroomCount: true, bathroomCount: true,
  bedCount: true, maxGuests: true, area: true, viewType: true, basePrice: true,
  currency: true, status: true, property: { select: { name: true, address: true } },
  amenities: { select: { amenity: { select: { code: true, nameVi: true, nameEn: true, icon: true, category: true } } } },
  media: { orderBy: { sortOrder: "asc" as const }, select: { type: true, sortOrder: true, media: { select: { url: true, width: true, height: true, altVi: true, altEn: true } } } },
  reviews: { where: { status: "APPROVED" as const }, select: { rating: true } },
};

@Controller("units")
export class UnitsController {
  constructor(private readonly prisma: PrismaService) {}

  @Public() @Get() @Version("1")
  list(@Query() query: UnitQuery) {
    let interval: { start: Date; end: Date } | undefined;
    if (query.checkIn || query.checkOut) {
      if (!query.checkIn || !query.checkOut) throw new BadRequestException("checkIn and checkOut are required together");
      interval = parseStay(query.checkIn, query.checkOut);
    }
    const occupancy = interval ? {
      bookings: { none: { status: { in: [BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN] }, checkIn: { lt: interval.end }, checkOut: { gt: interval.start } } },
      holds: { none: { status: HoldStatus.ACTIVE, expiresAt: { gt: new Date() }, startDate: { lt: interval.end }, endDate: { gt: interval.start } } },
      availabilityBlocks: { none: { state: { in: [AvailabilityState.BLOCKED, AvailabilityState.MAINTENANCE] }, startDate: { lt: interval.end }, endDate: { gt: interval.start } } },
    } : {};
    return this.prisma.unit.findMany({
      where: { status: "PUBLISHED", maxGuests: query.guests ? { gte: query.guests } : undefined, ...occupancy },
      skip: (query.page - 1) * query.limit, take: query.limit, select: publicSelect,
    });
  }

  @Public() @Get(":slug") @Version("1")
  async one(@Param("slug") slug: string) {
    const unit = await this.prisma.unit.findFirst({ where: { status: { in: ["PUBLISHED", "TEMP_UNAVAILABLE"] }, OR: [{ slugVi: slug }, { slugEn: slug }, { publicCode: slug }] }, select: publicSelect });
    if (!unit) throw new NotFoundException("Unit not found");
    return unit;
  }
}
