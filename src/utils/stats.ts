import type { Task } from '../types';
import type { PeriodRange } from './date';
import { isDateWithin } from './date';

export interface TaskCounts {
  planned: number;
  in_progress: number;
  completed: number;
  skipped: number;
}

export interface TaskSummary {
  total: number;
  counts: TaskCounts;
  completionRate: number;
  startedRate: number;
  droppedRate: number;
}

function calculateCounts(tasks: Task[], period: PeriodRange): TaskCounts {
  return tasks.reduce<TaskCounts>(
    (acc, task) => {
      if (!isDateWithin(task.scheduledFor, period)) {
        return acc;
      }
      acc[task.status] += 1;
      return acc;
    },
    { planned: 0, in_progress: 0, completed: 0, skipped: 0 }
  );
}

export function buildTaskSummary(tasks: Task[], period: PeriodRange): TaskSummary {
  const counts = calculateCounts(tasks, period);
  const total = counts.planned + counts.in_progress + counts.completed + counts.skipped;
  const completionRate = total === 0 ? 0 : counts.completed / total;
  const startedRate = total === 0 ? 0 : (counts.in_progress + counts.completed) / total;
  const droppedRate = total === 0 ? 0 : counts.skipped / total;

  return {
    total,
    counts,
    completionRate,
    startedRate,
    droppedRate
  };
}
