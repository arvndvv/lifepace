import { FormEvent, useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { useAppData } from '../context/AppDataContext';
import { getPeriodRanges, getTodayISO } from '../utils/date';
import {
  formatMinutes,
  getRemainingMinutesForDay,
  getTaskDurationMinutes,
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
}

type TaskViewRange = 'today' | 'week' | 'month' | 'all';

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
    durationMinutes: 0
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

interface ValidationSuccess {
  startAt?: string;
  deadlineAt?: string;
  durationMinutes?: number;
}

export default function TasksPage() {
  const {
    state: { tasks, preferences },
    actions
  } = useAppData();

  const defaultStartTime = preferences.defaultReminderTime ?? '';

  const [draft, setDraft] = useState<TaskDraftForm>(() => createDraft(defaultStartTime));
  const [formError, setFormError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<TaskDraftForm | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const [rangeFilter, setRangeFilter] = useState<TaskViewRange>('today');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);

  const today = getTodayISO();

  useEffect(() => {
    setDraft((prev) => ({
      ...prev,
      startTime: prev.mode === 'time' && !prev.startTime ? defaultStartTime : prev.startTime
    }));
  }, [defaultStartTime]);

  useEffect(() => {
    setPage(1);
  }, [rangeFilter, searchTerm]);

  const ranges = useMemo(() => getPeriodRanges(new Date()), []);

  const filteredTasks = useMemo(() => {
    return tasks
      .filter((task) => {
        if (!task.scheduledFor) {
          return false;
        }
        if (rangeFilter === 'today') {
          return task.scheduledFor === today;
        }
        if (rangeFilter === 'week') {
          const date = parseISO(task.scheduledFor);
          return date >= ranges.week.start && date < ranges.week.end;
        }
        if (rangeFilter === 'month') {
          const date = parseISO(task.scheduledFor);
          return date >= ranges.month.start && date < ranges.month.end;
        }
        return true;
      })
      .filter((task) => {
        if (!searchTerm.trim()) {
          return true;
        }
        const query = searchTerm.trim().toLowerCase();
        return (
          task.title.toLowerCase().includes(query) ||
          (task.description ?? '').toLowerCase().includes(query)
        );
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
  }, [tasks, rangeFilter, searchTerm, today, ranges]);

  const visibleTasks = useMemo(() => filteredTasks.slice(0, page * PAGE_SIZE), [filteredTasks, page]);

  const byDate = useMemo(() => {
    const grouped = new Map<string, typeof visibleTasks>();
    visibleTasks.forEach((task) => {
      const list = grouped.get(task.scheduledFor) ?? [];
      list.push(task);
      grouped.set(task.scheduledFor, list);
    });
    return Array.from(grouped.entries());
  }, [visibleTasks]);

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
      durationMinutes: validation.durationMinutes
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
      durationMinutes: isDuration ? totalMinutes % 60 : 0
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
      durationMinutes: validation.durationMinutes
    });
    setEditingTaskId(null);
    setEditDraft(null);
  };

  const allocationForDraft = getRemainingMinutesForDay(tasks, draft.scheduledFor);
  const allocationForEdit = editingTaskId && editDraft
    ? getRemainingMinutesForDay(tasks, editDraft.scheduledFor, editingTaskId)
    : null;

  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / PAGE_SIZE));
  const hasMore = page < totalPages;

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
              onClick={() => setRangeFilter(range)}
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

      {byDate.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">
          No tasks match your filters yet.
        </p>
      ) : (
        <div className="space-y-4">
          {byDate.map(([date, items]) => (
            <section key={date} className="space-y-3">
              <header className="flex items-center justify-between text-sm text-slate-400">
                <span className="font-semibold text-slate-200">{format(parseISO(date), 'EEEE, MMM d')}</span>
                <span>
                  {items.length} task{items.length === 1 ? '' : 's'} • {formatMinutes(
                    items.reduce((total, task) => total + getTaskDurationMinutes(task), 0)
                  )}{' '}
                  planned
                </span>
              </header>
              <ul className="space-y-2">
                {items.map((task) => {
                  const isEditing = editingTaskId === task.id && editDraft;
                  if (isEditing && editDraft) {
                    return (
                      <li key={task.id} className="space-y-2 rounded-2xl bg-slate-800/70 p-4">
                        <form className="space-y-3 text-sm" onSubmit={submitEdit}>
                          <input
                            className="w-full rounded-lg bg-slate-900 px-3 py-2"
                            value={editDraft.title}
                            onChange={(event) => setEditDraft((prev) => prev && { ...prev, title: event.target.value })}
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
                          {editError && <p className="text-sm text-rose-300">{editError}</p>}
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              className="rounded-lg px-3 py-2 text-slate-300"
                              onClick={() => {
                                setEditingTaskId(null);
                                setEditDraft(null);
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
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-slate-100">{task.title}</h3>
                            <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[11px] uppercase text-slate-300">
                              {task.status.replace('_', ' ')}
                            </span>
                          </div>
                          {task.description && <p className="text-sm text-slate-300">{task.description}</p>}
                          <p className="text-xs text-slate-400">
                            {task.startAt ? `Starts ${timeLabel(task.startAt)}` : 'No start time'}
                            {task.deadlineAt ? ` • Ends ${timeLabel(task.deadlineAt)}` : ''}
                            {task.durationMinutes
                              ? ` • Duration ${formatMinutes(task.durationMinutes)}`
                              : ''}
                            {task.reminderAt ? ` • Reminder ${timeLabel(task.reminderAt)}` : ''}
                          </p>
                        </div>
                        <div className="flex flex-col gap-1 text-xs">
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
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {hasMore && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setPage((prev) => prev + 1)}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
          >
            Load more
          </button>
        </div>
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
