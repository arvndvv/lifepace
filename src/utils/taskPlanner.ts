import { format, parseISO } from 'date-fns';
import type { Task } from '../types';
import { formatMinutes, getTotalAssignedMinutesForDate, MINUTES_PER_DAY } from './tasks';

export type TaskDraftMode = 'time' | 'duration';

export interface TaskDraftForm {
  title: string;
  description: string;
  scheduledFor: string;
  mode: TaskDraftMode;
  startTime: string;
  deadlineTime: string;
  durationHours: number;
  durationMinutes: number;
  progressive: boolean;
  tags: string[];
}

export interface ValidationSuccess {
  startAt?: string;
  deadlineAt?: string;
  durationMinutes?: number;
}

export function combineDateTime(dateISO: string, time: string): string | undefined {
  if (!time) {
    return undefined;
  }
  const [hours, minutes] = time.split(':').map((part) => Number.parseInt(part, 10));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return undefined;
  }
  const date = new Date(dateISO);
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

export function timeLabel(iso?: string): string | null {
  if (!iso) {
    return null;
  }
  try {
    return format(parseISO(iso), 'p');
  } catch (error) {
    return null;
  }
}

export function createTaskDraft(defaultStartTime: string): TaskDraftForm {
  return {
    title: '',
    description: '',
    scheduledFor: '',
    mode: 'time',
    startTime: defaultStartTime ?? '',
    deadlineTime: '',
    durationHours: 1,
    durationMinutes: 0,
    progressive: true,
    tags: []
  };
}

export function draftFromTask(task: Task, fallbackStartTime = ''): TaskDraftForm {
  const isDuration = typeof task.durationMinutes === 'number' && task.durationMinutes > 0;
  const totalMinutes = Math.max(0, task.durationMinutes ?? 0);
  return {
    title: task.title,
    description: task.description ?? '',
    scheduledFor: task.scheduledFor,
    mode: isDuration ? 'duration' : 'time',
    startTime: isDuration
      ? ''
      : task.startAt
      ? format(parseISO(task.startAt), 'HH:mm')
      : fallbackStartTime,
    deadlineTime:
      isDuration || !task.deadlineAt ? '' : format(parseISO(task.deadlineAt), 'HH:mm'),
    durationHours: isDuration ? Math.floor(totalMinutes / 60) : 1,
    durationMinutes: isDuration ? totalMinutes % 60 : 0,
    progressive: task.progressive ?? true,
    tags: task.tags ?? []
  };
}

export function canFitDuration(remainingMinutes: number, draft: TaskDraftForm): boolean {
  const candidate = getDraftDurationMinutes(draft);
  if (candidate === null) {
    return true;
  }
  return candidate <= remainingMinutes;
}

export function getDraftDurationMinutes(draft: TaskDraftForm): number | null {
  if (draft.mode === 'duration') {
    const minutes = Math.max(0, (draft.durationHours ?? 0) * 60 + (draft.durationMinutes ?? 0));
    return minutes;
  }
  const start = combineDateTime(draft.scheduledFor, draft.startTime || '');
  const end = combineDateTime(draft.scheduledFor, draft.deadlineTime || '');
  if (!start || !end) {
    return null;
  }
  const diff = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 60000);
  return Math.max(0, diff);
}

export function buildReminder(startAt: string | undefined, leadMinutes: number): string | undefined {
  if (!startAt) {
    return undefined;
  }
  if (!leadMinutes || leadMinutes <= 0) {
    return startAt;
  }
  const start = new Date(startAt);
  const reminder = new Date(start.getTime() - leadMinutes * 60 * 1000);
  return reminder.toISOString();
}

export function validateSchedule(
  tasks: Task[],
  scheduledFor: string,
  form: TaskDraftForm,
  excludeId?: string
): ValidationSuccess | { error: string } {
  if (!scheduledFor) {
    return { error: 'Choose a day for this task.' };
  }

  if (form.mode === 'duration') {
    const totalMinutes = Math.max(0, form.durationHours * 60 + form.durationMinutes);
    if (totalMinutes <= 0) {
      return { error: 'Set a duration greater than zero.' };
    }
    const existingAssigned = getTotalAssignedMinutesForDate(tasks, scheduledFor, excludeId);
    if (existingAssigned + totalMinutes > MINUTES_PER_DAY) {
      const remaining = Math.max(0, MINUTES_PER_DAY - existingAssigned);
      const suffix = remaining === 0 ? 'This day is already fully allocated.' : `Only ${formatMinutes(remaining)} left on this day.`;
      return { error: suffix };
    }
    return { durationMinutes: totalMinutes };
  }

  const startAt = combineDateTime(scheduledFor, form.startTime);
  const deadlineAt = form.deadlineTime ? combineDateTime(scheduledFor, form.deadlineTime) : undefined;

  if (deadlineAt && !startAt) {
    return { error: 'Set a start time before the deadline.' };
  }

  if (!startAt) {
    return {};
  }

  const startMs = new Date(startAt).getTime();
  if (Number.isNaN(startMs)) {
    return { error: 'Start time is invalid.' };
  }

  let deadlineMs: number | undefined;
  if (deadlineAt) {
    deadlineMs = new Date(deadlineAt).getTime();
    if (Number.isNaN(deadlineMs)) {
      return { error: 'Deadline is invalid.' };
    }
    if (deadlineMs <= startMs) {
      return { error: 'Deadline must be after the start time.' };
    }
    const existingAssigned = getTotalAssignedMinutesForDate(tasks, scheduledFor, excludeId);
    const candidateMinutes = Math.floor((deadlineMs - startMs) / 60000);
    if (existingAssigned + candidateMinutes > MINUTES_PER_DAY) {
      const remaining = Math.max(0, MINUTES_PER_DAY - existingAssigned);
      const suffix = remaining === 0 ? 'This day is already fully allocated.' : `Only ${formatMinutes(remaining)} left on this day.`;
      return { error: suffix };
    }
  }

  const conflictingTask = tasks.find((task) => {
    if (task.id === excludeId || task.scheduledFor !== scheduledFor || !task.startAt) {
      return false;
    }
    const existingStart = new Date(task.startAt).getTime();
    const existingDeadline = task.deadlineAt ? new Date(task.deadlineAt).getTime() : undefined;

    if (!Number.isFinite(existingStart)) {
      return false;
    }

    if (existingStart === startMs) {
      return true;
    }

    if (deadlineMs && existingDeadline) {
      return startMs < existingDeadline && existingStart < deadlineMs;
    }

    if (deadlineMs && !existingDeadline) {
      return existingStart > startMs && existingStart < deadlineMs;
    }

    if (!deadlineMs && existingDeadline) {
      return startMs > existingStart && startMs < existingDeadline;
    }

    return false;
  });

  if (conflictingTask) {
    const startLabel = timeLabel(conflictingTask.startAt) ?? 'that time';
    const endLabel = conflictingTask.deadlineAt ? ` to ${timeLabel(conflictingTask.deadlineAt)}` : '';
    return { error: `“${conflictingTask.title}” already occupies ${startLabel}${endLabel}.` };
  }

  return { startAt, deadlineAt };
}
