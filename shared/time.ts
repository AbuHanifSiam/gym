const weekdayIndex: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** Calendar date (YYYY-MM-DD) and weekday (0 = Sunday) at `now` in the given IANA timezone. */
export function localDay(
  timeZone: string,
  now: Date = new Date(),
): { date: string; dayIndex: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    dayIndex: weekdayIndex[get('weekday')],
  };
}

/** Adds days to a YYYY-MM-DD date (timezone independent). */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Weekday (0 = Sunday) of a YYYY-MM-DD date. */
export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

export const KG_PER_LB = 0.45359237;

export function kgToDisplay(kg: number, units: 'kg' | 'lb'): number {
  const v = units === 'lb' ? kg / KG_PER_LB : kg;
  return Math.round(v * 10) / 10;
}

export function displayToKg(v: number, units: 'kg' | 'lb'): number {
  return units === 'lb' ? Math.round(v * KG_PER_LB * 1000) / 1000 : v;
}

export const CM_PER_IN = 2.54;

/** Body measurements: cm stored, inches shown when the user uses lb. */
export function cmToDisplay(cm: number, units: 'kg' | 'lb'): number {
  const v = units === 'lb' ? cm / CM_PER_IN : cm;
  return Math.round(v * 10) / 10;
}

export function displayToCm(v: number, units: 'kg' | 'lb'): number {
  return units === 'lb' ? Math.round(v * CM_PER_IN * 100) / 100 : v;
}

export const lengthUnit = (units: 'kg' | 'lb') => (units === 'lb' ? 'in' : 'cm');
