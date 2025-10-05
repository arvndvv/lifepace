import {
  addWeeks,
  differenceInCalendarDays,
  differenceInMinutes,
  format,
  isAfter,
  isBefore,
  isSameWeek,
  parseISO,
  startOfDay,
  startOfWeek,
  subMinutes
} from 'date-fns';

export function toISODate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function getTodayISO(): string {
  return toISODate(new Date());
}

export function getDayProgress(dayStartHour: number, dayEndHour: number) {
  const now = new Date();
  const start = new Date(now);
  start.setHours(dayStartHour, 0, 0, 0);
  const end = new Date(now);
  end.setHours(dayEndHour, 0, 0, 0);

  const totalMinutes = Math.max(0, differenceInMinutes(end, start));
  const minutesElapsed = Math.min(Math.max(differenceInMinutes(now, start), 0), totalMinutes);
  const minutesRemaining = Math.max(totalMinutes - minutesElapsed, 0);
  const percentElapsed = totalMinutes === 0 ? 0 : Math.min(Math.max((minutesElapsed / totalMinutes) * 100, 0), 100);

  return { totalMinutes, minutesElapsed, minutesRemaining, percentElapsed };
}

type WeekCellStatus = 'past' | 'current' | 'future';

export interface WeekCell {
  id: string;
  start: Date;
  status: WeekCellStatus;
}

export function buildLifeCalendar(dateOfBirth: string, expectancyYears: number): WeekCell[] {
  const dob = startOfDay(parseISO(dateOfBirth));
  const today = startOfDay(new Date());
  const totalWeeks = expectancyYears * 52;

  const weeks: WeekCell[] = [];
  const firstWeekStart = startOfWeek(dob, { weekStartsOn: 1 });

  for (let i = 0; i < totalWeeks; i += 1) {
    const weekStart = addWeeks(firstWeekStart, i);
    let status: WeekCellStatus = 'future';
    if (isBefore(weekStart, startOfWeek(today, { weekStartsOn: 1 }))) {
      status = 'past';
    }
    if (isSameWeek(weekStart, today, { weekStartsOn: 1 })) {
      status = 'current';
    }

    weeks.push({ id: `${dateOfBirth}-week-${i}`, start: weekStart, status });
  }

  return weeks;
}

export interface PeriodRange {
  start: Date;
  end: Date;
  label: string;
}

export function getPeriodRanges(reference: Date = new Date()): { week: PeriodRange; month: PeriodRange; year: PeriodRange } {
  const startOfRefWeek = startOfWeek(reference, { weekStartsOn: 1 });
  const startOfRefMonth = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const startOfRefYear = new Date(reference.getFullYear(), 0, 1);

  const endOfWeek = addWeeks(startOfRefWeek, 1);
  const endOfMonth = new Date(reference.getFullYear(), reference.getMonth() + 1, 1);
  const endOfYear = new Date(reference.getFullYear() + 1, 0, 1);

  return {
    week: {
      start: startOfRefWeek,
      end: endOfWeek,
      label: `${format(startOfRefWeek, 'MMM d')} - ${format(subMinutes(endOfWeek, 1), 'MMM d')}`
    },
    month: {
      start: startOfRefMonth,
      end: endOfMonth,
      label: format(reference, 'MMMM yyyy')
    },
    year: {
      start: startOfRefYear,
      end: endOfYear,
      label: format(reference, 'yyyy')
    }
  };
}

export function isDateWithin(dateISO: string, range: PeriodRange): boolean {
  const date = parseISO(dateISO);
  return !isBefore(date, range.start) && isBefore(date, range.end);
}

export function daysBetween(dateISO: string): number {
  return differenceInCalendarDays(new Date(), parseISO(dateISO));
}
