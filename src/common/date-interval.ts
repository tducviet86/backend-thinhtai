import { BadRequestException } from '@nestjs/common';
export interface DateInterval { start: Date; end: Date }
export function parseStay(checkIn: string, checkOut: string): DateInterval {
  const start = new Date(`${checkIn}T00:00:00.000Z`); const end = new Date(`${checkOut}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkIn) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOut) || Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf()) || start.toISOString().slice(0, 10) !== checkIn || end.toISOString().slice(0, 10) !== checkOut || start >= end) throw new BadRequestException('checkOut must be after checkIn');
  return { start, end };
}
export function overlaps(a: DateInterval, b: DateInterval): boolean { return a.start < b.end && b.start < a.end; }
export function nightsBetween(start: Date, end: Date): number { return Math.round((end.valueOf() - start.valueOf()) / 86400000); }
export function eachNight(start: Date, end: Date): Date[] { return Array.from({ length: nightsBetween(start,end) }, (_,i)=>new Date(start.valueOf()+i*86400000)); }
