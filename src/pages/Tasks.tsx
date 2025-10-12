import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getMonth,
  getYear,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek
} from 'date-fns';
import { useAppData } from '../context/AppDataContext';
import type { Task, TaskStatus } from '../types';
import { getTodayISO } from '../utils/date';
import {
  formatMinutes,
  getRemainingMinutesForDay,
  getTotalAssignedMinutesForDate,
  MINUTES_PER_DAY
} from '../utils/tasks';

interface TaskDraftForm {
  title: string;
  description: string;
  scheduledFor: string;
  mode: 'time' | 'duration';
  startTime: string;
  deadlineTime: string;
  durationHours: number;
  durationMinutes: number;
  progressive: boolean;
}

type TaskViewRange = 'today' | 'week' | 'month' | 'all';

interface ValidationSuccess {
  startAt?: string;
  deadlineAt?: string;
  durationMinutes?: number;
}

const PAGE_SIZE = 10;

function combineDateTime(dateISO: string, time: string): string | undefined {
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

function timeLabel(iso?: string): string | null {
  if (!iso) {
    return null;
  }
  return format(parseISO(iso), 'p');
}

function buildReminder(startAt: string | undefined, leadMinutes: number): string | undefined {
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

function createDraft(defaultStartTime: string): TaskDraftForm {
  return {
    title: '',
    description: '',
    scheduledFor: getTodayISO(),
    mode: 'time',
    startTime: defaultStartTime ?? '',
    deadlineTime: '',
    durationHours: 1,
    durationMinutes: 0,
    progressive: true
  };
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
}

interface TaskScheduleFieldsProps {
  draft: TaskDraftForm;
  onChange: (updates: Partial<TaskDraftForm>) => void;
  allocation: { assigned: number; remaining: number };
}

function TaskScheduleFields({ draft, onChange, allocation }: TaskScheduleFieldsProps) {
  const switchMode = (mode: 'time' | 'duration') => {
    if (mode === draft.mode) {
      return;
    }
    if (mode === 'duration') {
      onChange({ mode, startTime: '', deadlineTime: '' });
      return;
    }
    onChange({ mode, durationHours: 1, durationMinutes: 0 });
  };

  const handleDurationChange = (field: 'durationHours' | 'durationMinutes', raw: string) => {
    const parsed = Number.parseInt(raw, 10);
    const nextValue = field === 'durationHours' ? clamp(parsed, 0, 24) : clamp(parsed, 0, 59);
    onChange({ [field]: nextValue });
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2 text-xs font-medium text-slate-300">
        <button
          type="button"
          className={`rounded-full px-3 py-1 transition-colors ${
            draft.mode === 'time'
              ? 'bg-[color:var(--accent-600)] text-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
          onClick={() => switchMode('time')}
        >
          Schedule by time
        </button>
        <button
          type="button"
          className={`rounded-full px-3 py-1 transition-colors ${
            draft.mode === 'duration'
              ? 'bg-[color:var(--accent-600)] text-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
          onClick={() => switchMode('duration')}
        >
          Assign duration
        </button>
      </div>

      <label className="space-y-1 text-sm">
        <span className="text-xs uppercase text-slate-400">Scheduled for</span>
        <input
          type="date"
          className="w-full rounded-lg bg-slate-900 px-3 py-2"
          value={draft.scheduledFor}
          onChange={(event) => onChange({ scheduledFor: event.target.value })}
          required
        />
      </label>

      {draft.mode === 'time' ? (
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <label className="space-y-1 text-sm">
            <span className="text-xs uppercase text-slate-400">Starts at (optional)</span>
            <input
              type="time"
              className="w-full rounded-lg bg-slate-900 px-3 py-2"
              value={draft.startTime}
              onChange={(event) => onChange({ startTime: event.target.value })}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs uppercase text-slate-400">Deadline (optional)</span>
            <input
              type="time"
              className="w-full rounded-lg bg-slate-900 px-3 py-2"
              value={draft.deadlineTime}
              onChange={(event) => onChange({ deadlineTime: event.target.value })}
            />
          </label>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <label className="space-y-1 text-sm">
            <span className="text-xs uppercase text-slate-400">Hours</span>
            <input
              type="number"
              min={0}
              max={24}
              className="w-full rounded-lg bg-slate-900 px-3 py-2"
              value={draft.durationHours}
              onChange={(event) => handleDurationChange('durationHours', event.target.value)}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs uppercase text-slate-400">Minutes</span>
            <input
              type="number"
              min={0}
              max={59}
              className="w-full rounded-lg bg-slate-900 px-3 py-2"
              value={draft.durationMinutes}
              onChange={(event) => handleDurationChange('durationMinutes', event.target.value)}
            />
          </label>
        </div>
      )}

      <p className="text-xs text-slate-500">
        Time assigned for this day: {formatMinutes(allocation.assigned)} • Time left: {formatMinutes(allocation.remaining)}
      </p>
    </div>
  );
}

function summarizeTasks(list: Task[]) {
  return list.reduce(
    (acc, task) => {
      acc.total += 1;
      if (task.status === 'completed') {
        acc.completed += 1;
      } else if (task.status === 'in_progress') {
        acc.inProgress += 1;
      }
      if (task.progressive ?? true) {
        acc.progressive += 1;
      }
      return acc;
    },
    { total: 0, completed: 0, inProgress: 0, progressive: 0 }
  );
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function TasksPage() {
  const {
    state: { tasks, preferences },
    actions
  } = useAppData();

  const defaultStartTime = preferences.defaultReminderTime ?? '';
  const today = getTodayISO();

  const [draft, setDraft] = useState<TaskDraftForm>(() => createDraft(defaultStartTime));
  const [formError, setFormError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<TaskDraftForm | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const [rangeFilter, setRangeFilter] = useState<TaskViewRange>('today');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [selectedDate, setSelectedDate] = useState(today);
  const [weekCursor, setWeekCursor] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()));

  useEffect(() => {
    setDraft((prev) => ({
      ...prev,
      startTime: prev.mode === 'time' && !prev.startTime ? defaultStartTime : prev.startTime
    }));
  }, [defaultStartTime]);

  useEffect(() => {
    setPage(1);
  }, [rangeFilter, searchTerm, selectedDate]);

  useEffect(() => {
    if (rangeFilter === 'week') {
      setWeekCursor(startOfWeek(parseISO(selectedDate), { weekStartsOn: 1 }));
    } else if (rangeFilter === 'month') {
      setMonthCursor(startOfMonth(parseISO(selectedDate)));
    }
  }, [rangeFilter, selectedDate]);

  const normalizedTasks = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return tasks
      .filter((task) => {
        if (!query) {
          return true;
        }
        const haystack = `${task.title} ${task.description ?? ''}`.toLowerCase();
        return haystack.includes(query);
      })
      .sort((a, b) => {
        const dateCompare = a.scheduledFor.localeCompare(b.scheduledFor);
        if (dateCompare !== 0) {
          return dateCompare;
        }
        const aStart = a.startAt ?? '';
        const bStart = b.startAt ?? '';
        return aStart.localeCompare(bStart);
      });
  }, [tasks, searchTerm]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    normalizedTasks.forEach((task) => {
      const existing = map.get(task.scheduledFor);
      if (existing) {
        existing.push(task);
      } else {
        map.set(task.scheduledFor, [task]);
      }
    });
    return map;
  }, [normalizedTasks]);

  const selectedDayTasks = useMemo(() => tasksByDate.get(selectedDate) ?? [], [tasksByDate, selectedDate]);

  const selectedDaySummary = useMemo(() => summarizeTasks(selectedDayTasks), [selectedDayTasks]);
  const selectedDayAllocation = useMemo(
    () => getRemainingMinutesForDay(tasks, selectedDate),
    [tasks, selectedDate]
  );

  const totalPages = Math.max(1, Math.ceil(selectedDayTasks.length / PAGE_SIZE));

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const paginatedTasks = useMemo(() => {
    const startIndex = (page - 1) * PAGE_SIZE;
    return selectedDayTasks.slice(startIndex, startIndex + PAGE_SIZE);
  }, [selectedDayTasks, page]);

  const selectedDateLabel = useMemo(() => {
    try {
      return format(parseISO(selectedDate), 'EEEE, MMM d');
    } catch (error) {
      return selectedDate;
    }
  }, [selectedDate]);

  const weekDays = useMemo(() => {
    const start = weekCursor;
    return eachDayOfInterval({ start, end: addDays(start, 6) });
  }, [weekCursor]);

  const weekSummaries = useMemo(
    () =>
      weekDays.map((date) => {
        const iso = format(date, 'yyyy-MM-dd');
        const list = tasksByDate.get(iso) ?? [];
        return { date, iso, summary: summarizeTasks(list) };
      }),
    [weekDays, tasksByDate]
  );

  const monthGrid = useMemo(() => {
    const start = startOfWeek(startOfMonth(monthCursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(monthCursor), { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start, end });
    const rows: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      rows.push(days.slice(i, i + 7));
    }
    return rows;
  }, [monthCursor]);

  const yearsSummary = useMemo(() => {
    const yearMap = new Map<number, Map<number, Task[]>>();
    normalizedTasks.forEach((task) => {
      const date = parseISO(task.scheduledFor);
      if (Number.isNaN(date.getTime())) {
        return;
      }
      const year = getYear(date);
      const month = getMonth(date);
      const monthMap = yearMap.get(year) ?? new Map<number, Task[]>();
      const bucket = monthMap.get(month);
      if (bucket) {
        bucket.push(task);
      } else {
        monthMap.set(month, [task]);
      }
      if (!yearMap.has(year)) {
        yearMap.set(year, monthMap);
      }
    });

    return Array.from(yearMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([year, monthMap]) => ({
        year,
        months: Array.from({ length: 12 }, (_, month) => ({
          month,
          summary: summarizeTasks(monthMap.get(month) ?? [])
        }))
      }));
  }, [normalizedTasks]);

  const handleViewChange = (next: TaskViewRange) => {
    setRangeFilter(next);
    if (next === 'today') {
      setSelectedDate((prev) => prev || today);
    } else if (next === 'week') {
      setWeekCursor(startOfWeek(parseISO(selectedDate), { weekStartsOn: 1 }));
    } else if (next === 'month') {
      setMonthCursor(startOfMonth(parseISO(selectedDate)));
    }
  };

  const goToDate = (iso: string) => {
    setSelectedDate(iso);
    setRangeFilter('today');
  };

  const moveWeek = (offset: number) => {
    setWeekCursor((prev) => addDays(prev, offset * 7));
  };

  const moveMonth = (offset: number) => {
    setMonthCursor((prev) => addMonths(prev, offset));
  };

  const resetDraft = () => setDraft(createDraft(defaultStartTime));

  const validateSchedule = (
    scheduledFor: string,
    form: TaskDraftForm,
    excludeId?: string
  ): ValidationSuccess | { error: string } => {
    if (!scheduledFor) {
      return { error: 'Choose a day for this task.' };
    }

    if (form.mode === 'duration') {
      const totalMinutes = form.durationHours * 60 + form.durationMinutes;
      if (totalMinutes <= 0) {
        return { error: 'Set a duration greater than zero.' };
      }
      const existingAssigned = getTotalAssignedMinutesForDate(tasks, scheduledFor, excludeId);
      if (existingAssigned + totalMinutes > MINUTES_PER_DAY) {
        const remaining = Math.max(0, MINUTES_PER_DAY - existingAssigned);
        const suffix =
          remaining === 0
            ? 'This day is already fully allocated.'
            : `Only ${formatMinutes(remaining)} left on this day.`;
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
        const suffix =
          remaining === 0
            ? 'This day is already fully allocated.'
            : `Only ${formatMinutes(remaining)} left on this day.`;
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
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (!draft.title.trim()) {
      setFormError('Give the task a name.');
      return;
    }

    const validation = validateSchedule(draft.scheduledFor, draft);
    if ('error' in validation) {
      setFormError(validation.error);
      return;
    }

    const startAt = validation.startAt;
    const deadlineAt = validation.deadlineAt;
    const reminderAt = buildReminder(startAt, preferences.reminderLeadMinutes);

    actions.addTask({
      title: draft.title.trim(),
      description: draft.description.trim() || undefined,
      scheduledFor: draft.scheduledFor,
      startAt,
      deadlineAt,
      reminderAt,
      durationMinutes: validation.durationMinutes,
      progressive: draft.progressive
    });

    resetDraft();
    setIsModalOpen(false);
  };

  const startEdit = (taskId: string) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) {
      return;
    }
    setEditingTaskId(task.id);
    setEditError(null);
    const isDuration = typeof task.durationMinutes === 'number' && task.durationMinutes > 0;
    const totalMinutes = Math.max(0, task.durationMinutes ?? 0);
    setEditDraft({
      title: task.title,
      description: task.description ?? '',
      scheduledFor: task.scheduledFor,
      mode: isDuration ? 'duration' : 'time',
      startTime: isDuration ? '' : task.startAt ? format(parseISO(task.startAt), 'HH:mm') : defaultStartTime,
      deadlineTime: isDuration
        ? ''
        : task.deadlineAt
        ? format(parseISO(task.deadlineAt), 'HH:mm')
        : '',
      durationHours: isDuration ? Math.floor(totalMinutes / 60) : 1,
      durationMinutes: isDuration ? totalMinutes % 60 : 0,
      progressive: task.progressive ?? true
    });
  };

  const submitEdit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingTaskId || !editDraft) {
      return;
    }
    setEditError(null);

    if (!editDraft.title.trim()) {
      setEditError('Task name cannot be empty.');
      return;
    }

    const validation = validateSchedule(editDraft.scheduledFor, editDraft, editingTaskId);
    if ('error' in validation) {
      setEditError(validation.error);
      return;
    }

    const startAt = validation.startAt;
    const deadlineAt = validation.deadlineAt;
    const reminderAt = buildReminder(startAt, preferences.reminderLeadMinutes);

    actions.updateTask(editingTaskId, {
      title: editDraft.title.trim(),
      description: editDraft.description.trim() || undefined,
      scheduledFor: editDraft.scheduledFor,
      startAt,
      deadlineAt,
      reminderAt,
      durationMinutes: validation.durationMinutes,
      progressive: editDraft.progressive
    });
    setEditingTaskId(null);
    setEditDraft(null);
  };

  const allocationForDraft = getRemainingMinutesForDay(tasks, draft.scheduledFor);
  const allocationForEdit =
    editingTaskId && editDraft
      ? getRemainingMinutesForDay(tasks, editDraft.scheduledFor, editingTaskId)
      : null;

  const hasPrevPage = page > 1;
  const hasNextPage = page < totalPages;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 text-xs font-medium text-slate-300">
          {(['today', 'week', 'month', 'all'] as TaskViewRange[]).map((range) => (
            <button
              key={range}
              type="button"
              className={`rounded-full px-3 py-1 transition-colors ${
                rangeFilter === range
                  ? 'bg-[color:var(--accent-600)] text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
              onClick={() => handleViewChange(range)}
              aria-pressed={rangeFilter === range}
            >
              {range === 'today' && 'Today'}
              {range === 'week' && 'This week'}
              {range === 'month' && 'This month'}
              {range === 'all' && 'All tasks'}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            placeholder="Search tasks"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-200"
          />
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="rounded-lg bg-[color:var(--accent-600)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[color:var(--accent-500)]"
          >
            Add task
          </button>
        </div>
      </div>

      {rangeFilter === 'today' && (
        <section className="space-y-4">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-200">{selectedDateLabel}</h2>
              <p className="text-xs text-slate-400">
                {selectedDayTasks.length} task{selectedDayTasks.length === 1 ? '' : 's'} • Time assigned{' '}
                {formatMinutes(selectedDayAllocation.assigned)} • Time free {formatMinutes(selectedDayAllocation.remaining)}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <button
                type="button"
                className="rounded-full bg-slate-800 px-3 py-1 hover:bg-slate-700"
                onClick={() => {
                  setSelectedDate(today);
                  setRangeFilter('today');
                }}
              >
                Jump to today
              </button>
            </div>
          </header>

          <div className="grid grid-cols-2 gap-3 text-xs text-slate-300 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <p className="text-[11px] uppercase text-slate-500">Planned</p>
              <p className="text-lg font-semibold text-slate-100">{selectedDaySummary.total}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <p className="text-[11px] uppercase text-slate-500">In progress</p>
              <p className="text-lg font-semibold text-sky-300">{selectedDaySummary.inProgress}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <p className="text-[11px] uppercase text-slate-500">Completed</p>
              <p className="text-lg font-semibold text-emerald-300">{selectedDaySummary.completed}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <p className="text-[11px] uppercase text-slate-500">Progressive</p>
              <p className="text-lg font-semibold text-amber-300">{selectedDaySummary.progressive}</p>
            </div>
          </div>

          {selectedDayTasks.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">
              No tasks planned for this day. Add one above.
            </p>
          ) : (
            <>
              <ul className="space-y-2">
                {paginatedTasks.map((task) => {
                  const isEditing = editingTaskId === task.id && editDraft;
                  if (isEditing && editDraft) {
                    return (
                      <li key={task.id} className="space-y-2 rounded-2xl bg-slate-800/70 p-4">
                        <form className="space-y-3 text-sm" onSubmit={submitEdit}>
                          <input
                            className="w-full rounded-lg bg-slate-900 px-3 py-2"
                            value={editDraft.title}
                            onChange={(event) =>
                              setEditDraft((prev) => prev && { ...prev, title: event.target.value })
                            }
                          />
                          <textarea
                            className="w-full rounded-lg bg-slate-900 px-3 py-2"
                            value={editDraft.description}
                            onChange={(event) =>
                              setEditDraft((prev) => prev && { ...prev, description: event.target.value })
                            }
                            rows={3}
                          />
                          <TaskScheduleFields
                            draft={editDraft}
                            allocation={allocationForEdit ?? { assigned: 0, remaining: MINUTES_PER_DAY }}
                            onChange={(updates) =>
                              setEditDraft((prev) => (prev ? { ...prev, ...updates } : prev))
                            }
                          />
                          <label className="flex items-start gap-2 rounded-lg bg-slate-800/60 px-3 py-2 text-xs text-slate-300">
                            <input
                              type="checkbox"
                              checked={editDraft.progressive}
                              onChange={(event) =>
                                setEditDraft((prev) => prev && {
                                  ...prev,
                                  progressive: event.target.checked
                                })
                              }
                              className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-900"
                            />
                            <span>
                              Counts toward daily progress{' '}
                              <span className="text-slate-500">
                                (need at least {preferences.progressiveTasksPerDay} per day)
                              </span>
                            </span>
                          </label>
                          {editError && <p className="text-sm text-rose-300">{editError}</p>}
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              className="rounded-lg px-3 py-2 text-slate-300"
                              onClick={() => {
                                setEditingTaskId(null);
                                setEditDraft(null);
                                setEditError(null);
                              }}
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              className="rounded-lg bg-[color:var(--accent-600)] px-4 py-2 font-semibold text-white transition-colors hover:bg-[color:var(--accent-500)]"
                            >
                              Save
                            </button>
                          </div>
                        </form>
                      </li>
                    );
                  }

                  return (
                    <li key={task.id} className="rounded-2xl bg-slate-800/70 p-4">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-medium text-slate-100">{task.title}</h3>
                              <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[11px] uppercase text-slate-300">
                                {task.status.replace('_', ' ')}
                              </span>
                              {task.progressive && (
                                <span className="rounded-full bg-emerald-600/30 px-2 py-0.5 text-[11px] uppercase text-emerald-200">
                                  Progressive
                                </span>
                              )}
                            </div>
                            {task.description && <p className="text-sm text-slate-300">{task.description}</p>}
                            <p className="text-xs text-slate-400">
                              {task.startAt ? `Starts ${timeLabel(task.startAt)}` : 'No start time'}
                              {task.deadlineAt ? ` • Ends ${timeLabel(task.deadlineAt)}` : ''}
                              {task.durationMinutes ? ` • Duration ${formatMinutes(task.durationMinutes)}` : ''}
                              {task.reminderAt ? ` • Reminder ${timeLabel(task.reminderAt)}` : ''}
                            </p>
                          </div>
                          <div className="flex gap-2 text-xs">
                            <button
                              className="rounded-lg bg-slate-700 px-3 py-1 text-slate-200"
                              onClick={() => startEdit(task.id)}
                            >
                              Edit
                            </button>
                            <button
                              className="rounded-lg bg-slate-700 px-3 py-1 text-rose-300"
                              onClick={() => actions.deleteTask(task.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs">
                          {(['planned', 'in_progress', 'completed', 'skipped'] as TaskStatus[]).map((status) => (
                            <button
                              key={status}
                              type="button"
                              className={`rounded-full px-3 py-1 capitalize transition-colors ${
                                task.status === status
                                  ? 'bg-[color:var(--accent-600)] text-white'
                                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                              }`}
                              onClick={() => actions.setTaskStatus(task.id, status)}
                            >
                              {status.replace('_', ' ')}
                            </button>
                          ))}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {totalPages > 1 && (
                <div className="flex items-center justify-between gap-3 text-xs text-slate-400">
                  <button
                    type="button"
                    className="rounded-full bg-slate-800 px-3 py-1 enabled:hover:bg-slate-700 disabled:opacity-40"
                    onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                    disabled={!hasPrevPage}
                  >
                    Previous
                  </button>
                  <span>
                    Page {page} of {totalPages}
                  </span>
                  <button
                    type="button"
                    className="rounded-full bg-slate-800 px-3 py-1 enabled:hover:bg-slate-700 disabled:opacity-40"
                    onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={!hasNextPage}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {rangeFilter === 'week' && (
        <section className="space-y-4">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-200">Week of {format(weekCursor, 'MMM d')}</h2>
              <p className="text-xs text-slate-400">Select a day to jump into the detailed view.</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <button
                type="button"
                className="rounded-full bg-slate-800 px-3 py-1 hover:bg-slate-700"
                onClick={() => moveWeek(-1)}
              >
                Previous
              </button>
              <button
                type="button"
                className="rounded-full bg-slate-800 px-3 py-1 hover:bg-slate-700"
                onClick={() => {
                  setWeekCursor(startOfWeek(new Date(), { weekStartsOn: 1 }));
                  setSelectedDate(today);
                }}
              >
                This week
              </button>
              <button
                type="button"
                className="rounded-full bg-slate-800 px-3 py-1 hover:bg-slate-700"
                onClick={() => moveWeek(1)}
              >
                Next
              </button>
            </div>
          </header>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
            {weekSummaries.map(({ date, iso, summary }) => {
              const isSelected = iso === selectedDate;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => goToDate(iso)}
                  className={`rounded-2xl border px-3 py-3 text-left transition-colors ${
                    isSelected
                      ? 'border-[color:var(--accent-500)] bg-[color:var(--accent-500)]/10'
                      : 'border-slate-800 bg-slate-900/60 hover:border-[color:var(--accent-500)]/60'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-semibold text-slate-200">{format(date, 'EEE')}</span>
                    <span>{format(date, 'MMM d')}</span>
                  </div>
                  <div className="mt-3 space-y-1 text-[11px] text-slate-300">
                    <p>Total {summary.total}</p>
                    <p className="text-emerald-300">Completed {summary.completed}</p>
                    <p className="text-sky-300">In progress {summary.inProgress}</p>
                    <p className="text-amber-300">Progressive {summary.progressive}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {rangeFilter === 'month' && (
        <section className="space-y-4">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-200">{format(monthCursor, 'MMMM yyyy')}</h2>
              <p className="text-xs text-slate-400">Click a day to open it in the Today view.</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <button
                type="button"
                className="rounded-full bg-slate-800 px-3 py-1 hover:bg-slate-700"
                onClick={() => moveMonth(-1)}
              >
                Previous
              </button>
              <button
                type="button"
                className="rounded-full bg-slate-800 px-3 py-1 hover:bg-slate-700"
                onClick={() => {
                  const now = new Date();
                  setMonthCursor(startOfMonth(now));
                  setSelectedDate(format(now, 'yyyy-MM-dd'));
                }}
              >
                This month
              </button>
              <button
                type="button"
                className="rounded-full bg-slate-800 px-3 py-1 hover:bg-slate-700"
                onClick={() => moveMonth(1)}
              >
                Next
              </button>
            </div>
          </header>
          <div className="grid grid-cols-7 gap-2 text-[11px] uppercase tracking-wide text-slate-500">
            {WEEKDAY_LABELS.map((label) => (
              <span key={label} className="text-center">
                {label}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2 text-xs">
            {monthGrid.map((week, weekIndex) =>
              week.map((date, dayIndex) => {
                const iso = format(date, 'yyyy-MM-dd');
                const summary = summarizeTasks(tasksByDate.get(iso) ?? []);
                const inMonth = isSameMonth(date, monthCursor);
                const isSelected = iso === selectedDate;
                return (
                  <button
                    key={`${weekIndex}-${dayIndex}`}
                    type="button"
                    onClick={() => goToDate(iso)}
                    className={`rounded-xl border px-2 py-2 text-left transition-colors ${
                      isSelected
                        ? 'border-[color:var(--accent-500)] bg-[color:var(--accent-500)]/10'
                        : inMonth
                        ? 'border-slate-800 bg-slate-900/60 hover:border-[color:var(--accent-500)]/60'
                        : 'border-slate-900 bg-slate-900/30 text-slate-600'
                    }`}
                  >
                    <span className="block text-xs font-semibold text-slate-200">{format(date, 'd')}</span>
                    {summary.total > 0 && (
                      <div className="mt-1 space-y-0.5 text-[10px] text-slate-300">
                        <p className="text-emerald-300">C {summary.completed}</p>
                        <p className="text-sky-300">P {summary.inProgress}</p>
                        <p className="text-amber-300">G {summary.progressive}</p>
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </section>
      )}

      {rangeFilter === 'all' && (
        <section className="space-y-6">
          {yearsSummary.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">
              No tasks recorded yet. Start planning to see yearly stats.
            </p>
          ) : (
            yearsSummary.map(({ year, months }) => (
              <div key={year} className="space-y-3">
                <header className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-slate-200">{year}</h2>
                  <span className="text-xs text-slate-400">Tap a month to dig deeper.</span>
                </header>
                <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {months.map(({ month, summary }) => {
                    const monthDate = new Date(year, month, 1);
                    const iso = format(monthDate, 'yyyy-MM-dd');
                    const hasTasks = summary.total > 0;
                    return (
                      <button
                        key={`${year}-${month}`}
                        type="button"
                        onClick={() => {
                          setSelectedDate(iso);
                          setMonthCursor(startOfMonth(monthDate));
                          handleViewChange('month');
                        }}
                        className={`rounded-2xl border px-3 py-3 text-left transition-colors ${
                          hasTasks
                            ? 'border-slate-800 bg-slate-900/60 hover:border-[color:var(--accent-500)]/60'
                            : 'border-slate-900 bg-slate-900/30 text-slate-600 hover:border-slate-800'
                        }`}
                      >
                        <span className="text-sm font-semibold text-slate-200">{format(monthDate, 'MMM')}</span>
                        <div className="mt-2 space-y-1 text-[11px] text-slate-300">
                          <p>Total {summary.total}</p>
                          <p className="text-emerald-300">Completed {summary.completed}</p>
                          <p className="text-sky-300">In progress {summary.inProgress}</p>
                          <p className="text-amber-300">Progressive {summary.progressive}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </section>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-100">Plan a task</h2>
              <button
                type="button"
                className="rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-300 hover:bg-slate-700"
                onClick={() => {
                  setIsModalOpen(false);
                  setFormError(null);
                  resetDraft();
                }}
              >
                Close
              </button>
            </div>
            <form className="space-y-3" onSubmit={handleSubmit}>
              <input
                className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-100"
                placeholder="What will you do?"
                value={draft.title}
                onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
                required
              />
              <textarea
                className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-100"
                placeholder="Add an optional note"
                value={draft.description}
                onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
                rows={3}
              />
              <TaskScheduleFields
                draft={draft}
                allocation={allocationForDraft}
                onChange={(updates) => setDraft((prev) => ({ ...prev, ...updates }))}
              />
              <label className="flex items-start gap-2 rounded-lg bg-slate-800/60 px-3 py-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={draft.progressive}
                  onChange={(event) => setDraft((prev) => ({ ...prev, progressive: event.target.checked }))}
                  className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-900"
                />
                <span>
                  Counts toward daily progress{' '}
                  <span className="text-slate-500">
                    (need at least {preferences.progressiveTasksPerDay} per day)
                  </span>
                </span>
              </label>
              {formError && <p className="text-sm text-rose-300">{formError}</p>}
              <p className="text-xs text-slate-400">
                Reminders fire {preferences.reminderLeadMinutes} minutes before start when notifications are enabled.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-lg px-3 py-2 text-slate-300"
                  onClick={() => {
                    setIsModalOpen(false);
                    setFormError(null);
                    resetDraft();
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[color:var(--accent-600)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[color:var(--accent-500)]"
                >
                  Add task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
