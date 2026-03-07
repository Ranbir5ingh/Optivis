// src/shared/utils/date.utils.ts

export function toUtcDayStart(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function toUtcDayEnd(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

export function toUtcHourStart(date: Date): Date {
  const d = new Date(date);
  d.setUTCMinutes(0, 0, 0);
  return d;
}

export function toUtcHourEnd(date: Date): Date {
  const d = new Date(date);
  d.setUTCMinutes(59, 59, 999);
  return d;
}

export function getNextDayStart(date: Date): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function getNextHourStart(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(d.getUTCHours() + 1);
  d.setUTCMinutes(0, 0, 0);
  return d;
}

export function daysDifference(start: Date, end: Date): number {
  const startUtc = toUtcDayStart(start);
  const endUtc = toUtcDayStart(end);
  return Math.ceil((endUtc.getTime() - startUtc.getTime()) / (1000 * 60 * 60 * 24));
}

export function subtractDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() - days);
  return toUtcDayStart(d);
}

export function getPreviousDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() - 1);
  return toUtcDayStart(d);
}

export function getPreviousPeriodStart(startDate: Date, daysDiff: number): Date {
  return subtractDays(startDate, daysDiff);
}