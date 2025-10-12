import { differenceInMinutes, parseISO } from 'date-fns';
import type { Task } from '../types';

const MINUTES_PER_DAY = 24 * 60;

export function getTaskDurationMinutes(task: Task): number {
  if (typeof task.durationMinutes === 'number' && Number.isFinite(task.durationMinutes)) {
    return Math.max(0, Math.floor(task.durationMinutes));
  }
  if (task.startAt && task.deadlineAt) {
    const start = parseISO(task.startAt);
    const end = parseISO(task.deadlineAt);
    const diff = differenceInMinutes(end, start);
    return Math.max(0, diff);
  }
  return 0;
}

export function getTotalAssignedMinutesForDate(
  tasks: Task[],
  dateISO: string,
  excludeId?: string
): number {
  return tasks
    .filter((task) => task.scheduledFor === dateISO && task.id !== excludeId)
    .reduce((total, task) => total + getTaskDurationMinutes(task), 0);
}

export function formatMinutes(totalMinutes: number): string {
  const minutes = Math.max(0, Math.floor(totalMinutes));
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) {
    return `${remainder}m`;
  }
  if (remainder === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${remainder}m`;
}

export function getRemainingMinutesForDay(
  tasks: Task[],
  dateISO: string,
  excludeId?: string
): { assigned: number; remaining: number } {
  const total = getTotalAssignedMinutesForDate(tasks, dateISO, excludeId);
  const capped = Math.min(MINUTES_PER_DAY, total);
  return { assigned: total, remaining: Math.max(0, MINUTES_PER_DAY - capped) };
}

export { MINUTES_PER_DAY };
