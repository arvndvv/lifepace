import { addWeeks, differenceInCalendarWeeks, parseISO, startOfWeek } from 'date-fns';
import { isDateWithin } from './date';
import type { DaySummary, Preferences, Task, UserProfile } from '../types';

const WEEK_OPTIONS = { weekStartsOn: 1 as const };

export function getWeekIdForDate(dateISO: string, dateOfBirth: string): string {
  const dobStart = startOfWeek(parseISO(dateOfBirth), WEEK_OPTIONS);
  const dateStart = startOfWeek(parseISO(dateISO), WEEK_OPTIONS);
  const diff = Math.max(0, differenceInCalendarWeeks(dateStart, dobStart, WEEK_OPTIONS));
  return `${dateOfBirth}-week-${diff}`;
}

export function getWeekStartDate(weekId: string, dateOfBirth: string): Date {
  const match = weekId.match(/-week-(\d+)$/);
  const index = match ? Number.parseInt(match[1], 10) : 0;
  const base = startOfWeek(parseISO(dateOfBirth), WEEK_OPTIONS);
  return addWeeks(base, Number.isNaN(index) ? 0 : index);
}

interface DayAccumulator {
  total: number;
  completed: number;
  inProgress: number;
  progressive: number;
}

export function computeDaySummaries(
  tasks: Task[],
  preferences: Preferences,
  profile: UserProfile
): Record<string, DaySummary> {
  const byDate = new Map<string, DayAccumulator>();

  tasks.forEach((task) => {
    const date = task.scheduledFor;
    if (!date) {
      return;
    }
    const bucket = byDate.get(date) ?? { total: 0, completed: 0, inProgress: 0, progressive: 0 };
    bucket.total += 1;
    if (task.status === 'completed') {
      bucket.completed += 1;
    }
    if (task.status === 'in_progress') {
      bucket.inProgress += 1;
    }
    if (task.progressive ?? true) {
      bucket.progressive += 1;
    }
    byDate.set(date, bucket);
  });

  const threshold = Math.min(
    Math.max(preferences.dayFulfillmentThreshold ?? 40, 0),
    100
  );
  const progressiveThreshold = preferences.progressiveTasksPerDay ?? 1;

  const summaries: Record<string, DaySummary> = {};

  byDate.forEach((bucket, date) => {
    const completionRate = bucket.total === 0 ? 0 : bucket.completed / bucket.total;
    const fulfilled = bucket.total > 0 && completionRate * 100 >= threshold;
    const progressed = progressiveThreshold <= 0 || bucket.progressive >= progressiveThreshold;
    summaries[date] = {
      date,
      completionRate,
      totalTasks: bucket.total,
      completedTasks: bucket.completed,
      inProgressTasks: bucket.inProgress,
      progressiveTasks: bucket.progressive,
      progressed,
      weekId: getWeekIdForDate(date, profile.dateOfBirth),
      fulfilled: progressed
    };
  });

  return summaries;
}

export function deriveAutoWeekWins(
  daySummaries: Record<string, DaySummary>,
  weekTarget: number
): Set<string> {
  const counts = new Map<string, number>();
  Object.values(daySummaries).forEach((summary) => {
    if (!summary.progressed) {
      return;
    }
    counts.set(summary.weekId, (counts.get(summary.weekId) ?? 0) + 1);
  });

  const target = Math.min(Math.max(weekTarget, 1), 7);
  const wins = new Set<string>();
  counts.forEach((value, weekId) => {
    if (value >= target) {
      wins.add(weekId);
    }
  });
  return wins;
}

export function filterDaySummariesByRange(
  daySummaries: Record<string, DaySummary>,
  range: { start: Date; end: Date }
): Record<string, DaySummary> {
  const filtered: Record<string, DaySummary> = {};
  Object.entries(daySummaries).forEach(([date, summary]) => {
    if (isDateWithin(date, { start: range.start, end: range.end, label: 'custom' })) {
      filtered[date] = summary;
    }
  });
  return filtered;
}
