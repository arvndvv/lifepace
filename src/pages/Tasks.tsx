import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getYear,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek
} from 'date-fns';
import { useAppData } from '../context/AppDataContext';
import type { Task, TaskStatus } from '../types';
import { TaskPlannerModal } from '../components/tasks/TaskPlannerModal';
import { TaskDetailsDialog } from '../components/tasks/TaskDetailsDialog';
import { MarkdownContent } from '../components/MarkdownContent';
import { getDayProgress, getTodayISO } from '../utils/date';
import {
  formatMinutes,
  getRemainingMinutesForDay,
  getTotalAssignedMinutesForDate,
  getTaskDurationMinutes,
  MINUTES_PER_DAY
} from '../utils/tasks';
import {
  createTaskDraft,
  draftFromTask,
  validateSchedule,
  canFitDuration,
  buildReminder,
  timeLabel,
  type TaskDraftForm
} from '../utils/taskPlanner';

export type TaskViewRange = 'today' | 'week' | 'month' | 'all';

const PAGE_SIZE = 10;

interface TaskAggregate {
  total: number;
  completed: number;
  inProgress: number;
  progressive: number;
  assignedMinutes: number;
  spentMinutes: number;
  progressiveMinutes: number;
  statusMinutes: Record<TaskStatus, number>;
  statusCounts: Record<TaskStatus, number>;
}


function summarizeTasks(list: Task[]): TaskAggregate {
  const initial: TaskAggregate = {
    total: 0,
    completed: 0,
    inProgress: 0,
    progressive: 0,
    assignedMinutes: 0,
    spentMinutes: 0,
    progressiveMinutes: 0,
    statusMinutes: {
      planned: 0,
      in_progress: 0,
      completed: 0,
      skipped: 0
    },
    statusCounts: {
      planned: 0,
      in_progress: 0,
      completed: 0,
      skipped: 0
    }
  };

  return list.reduce((acc, task) => {
    acc.total += 1;
    acc.statusCounts[task.status] += 1;
    if (task.status === 'completed') {
      acc.completed += 1;
    } else if (task.status === 'in_progress') {
      acc.inProgress += 1;
    }
    const progressiveEligible = (task.progressive ?? true) && task.status !== 'skipped';
    if (progressiveEligible) {
      acc.progressive += 1;
    }
    const minutes = getTaskDurationMinutes(task);
    acc.assignedMinutes += minutes;
    if (task.status === 'completed') {
      acc.spentMinutes += minutes;
    }
    acc.statusMinutes[task.status] += minutes;
    if (progressiveEligible) {
      acc.progressiveMinutes += minutes;
    }
    return acc;
  }, initial);
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function TasksPage() {
  const {
    state: { tasks, preferences, taskTags, profile },
    actions
  } = useAppData();

  const defaultStartTime = preferences.defaultReminderTime ?? '';
  const today = getTodayISO();

  const [plannerModal, setPlannerModal] = useState<{ mode: 'create' } | { mode: 'edit'; taskId: string } | null>(
    null
  );
  const [plannerDraft, setPlannerDraft] = useState<TaskDraftForm>(() => {
    const base = createTaskDraft(defaultStartTime);
    return { ...base, scheduledFor: getTodayISO() };
  });
  const [plannerError, setPlannerError] = useState<string | null>(null);
  const [viewTaskId, setViewTaskId] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [pendingTagFilters, setPendingTagFilters] = useState<string[]>([]);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Record<string, boolean>>({});
  const filterDropdownRef = useRef<HTMLDivElement | null>(null);

  const [rangeFilter, setRangeFilter] = useState<TaskViewRange>('today');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [selectedDate, setSelectedDate] = useState(today);
  const [weekCursor, setWeekCursor] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()));
  useEffect(() => {
    setPlannerDraft((prev) => ({
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

  useEffect(() => {
    if (isFilterOpen) {
      setPendingTagFilters(selectedTags);
    }
  }, [isFilterOpen, selectedTags]);

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

  const filteredTasks = useMemo(() => {
    if (selectedTags.length === 0) {
      return normalizedTasks;
    }
    return normalizedTasks.filter((task) =>
      task.tags.some((tag) => selectedTags.includes(tag))
    );
  }, [normalizedTasks, selectedTags]);

  const globalSummary = useMemo(() => summarizeTasks(filteredTasks), [filteredTasks]);

  const selectedTagSummaries = useMemo(
    () =>
      selectedTags.map((tag) => ({
        tag,
        summary: summarizeTasks(normalizedTasks.filter((task) => task.tags.includes(tag)))
      })),
    [normalizedTasks, selectedTags]
  );

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    filteredTasks.forEach((task) => {
      const existing = map.get(task.scheduledFor);
      if (existing) {
        existing.push(task);
      } else {
        map.set(task.scheduledFor, [task]);
      }
    });
    return map;
  }, [filteredTasks]);

  const selectedDayTasks = useMemo(() => tasksByDate.get(selectedDate) ?? [], [tasksByDate, selectedDate]);

  const selectedDaySummary = useMemo(() => summarizeTasks(selectedDayTasks), [selectedDayTasks]);
  const selectedDayAllocation = useMemo(
    () => getRemainingMinutesForDay(tasks, selectedDate, undefined, { excludeCompleted: true }),
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

  useEffect(() => {
    if (isFilterOpen) {
      setPendingTagFilters(selectedTags);
    }
  }, [isFilterOpen, selectedTags]);

  useEffect(() => {
    if (!isFilterOpen) {
      return;
    }
    const handleClickOutside = (event: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsFilterOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isFilterOpen]);

  const viewTask = useMemo(() => tasks.find((t) => t.id === viewTaskId) || null, [tasks, viewTaskId]);

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
    const yearMap = new Map<number, Task[]>();
    filteredTasks.forEach((task) => {
      const date = parseISO(task.scheduledFor);
      if (Number.isNaN(date.getTime())) {
        return;
      }
      const year = getYear(date);
      const list = yearMap.get(year) ?? [];
      list.push(task);
      yearMap.set(year, list);
    });

    return Array.from(yearMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([year, list]) => ({ year, summary: summarizeTasks(list) }));
  }, [filteredTasks]);

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

  const goToYear = (year: number) => {
    const target = startOfMonth(new Date(year, 0, 1));
    setMonthCursor(target);
    setSelectedDate(format(target, 'yyyy-MM-dd'));
    setRangeFilter('month');
  };

  const applyTagFilters = () => {
    setSelectedTags(pendingTagFilters);
    setIsFilterOpen(false);
  };

  const clearSelectedTags = () => {
    setPendingTagFilters([]);
    setSelectedTags([]);
  };

  const togglePendingTag = (tag: string) => {
    setPendingTagFilters((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]
    );
  };

  const FiltersPanel = () => (
    <>
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <label className="mb-1 block text-xs uppercase text-slate-400">Search tasks</label>
            <input
              type="search"
              placeholder="Search by task or description"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-2 text-sm text-slate-100 focus:border-[color:var(--accent-500)] focus:outline-none"
            />
          </div>
          <div className="min-w-[240px]">
            <label className="mb-1 block text-xs uppercase text-slate-400">Filters</label>
            <div className="relative flex flex-wrap items-center gap-2" ref={filterDropdownRef}>
              {selectedTags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-3 py-1 text-[11px] text-slate-200"
                >
                  {tag}
                </span>
              ))}
              <button
                type="button"
                onClick={() => setIsFilterOpen((prev) => !prev)}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors ${
                  isFilterOpen || selectedTags.length > 0
                    ? 'border-[color:var(--accent-500)] bg-[color:var(--accent-500)]/10 text-slate-100'
                    : 'border-slate-700 bg-slate-900/60 text-slate-200 hover:border-[color:var(--accent-500)]/60'
                }`}
              >
                <span>Tag</span>
                <span className="text-[11px] uppercase tracking-wide text-slate-400">
                  {selectedTags.length} selected
                </span>
              </button>
              {selectedTags.length > 0 && (
                <button
                  type="button"
                  className="text-[11px] text-slate-400 underline-offset-2 transition-colors hover:text-rose-300 hover:underline"
                  onClick={() => {
                    clearSelectedTags();
                    setIsFilterOpen(false);
                  }}
                >
                  Clear
                </button>
              )}
            
              {isFilterOpen && (
                <div className="absolute right-0 top-full z-30 mt-2 w-64 rounded-2xl border border-slate-700 bg-slate-900/95 shadow-xl">
                  <div className="px-4 pt-4">
                    <p className="mb-3 text-xs text-slate-400">Choose tags to focus this view.</p>
                  </div>
                  {taskTags.length === 0 ? (
                    <p className="px-4 pb-4 text-xs text-slate-500">No tags yet. Add some in Settings.</p>
                  ) : (
                    <ul className="max-h-52 overflow-auto px-2 pb-2 text-sm text-slate-200">
                      {taskTags.map((tag) => {
                        const active = pendingTagFilters.includes(tag);
                        return (
                          <li key={tag}>
                            <button
                              type="button"
                              onClick={() => togglePendingTag(tag)}
                              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition-colors ${
                                active ? 'bg-[color:var(--accent-600)]/20 text-slate-50' : 'hover:bg-slate-800/80'
                              }`}
                            >
                              <span>{tag}</span>
                              <span
                                className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                                  active
                                    ? 'border-[color:var(--accent-500)] bg-[color:var(--accent-600)]/30 text-[color:var(--accent-200)]'
                                    : 'border-slate-700 text-transparent'
                                }`}
                                aria-hidden="true"
                              >
                                ✓
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <div className="border-t border-slate-800/60 px-4 py-3 text-xs">
                    <div className="flex items-center justify-between gap-2 text-slate-300">
                      <button
                        type="button"
                        className="text-slate-400 transition-colors hover:text-rose-300"
                        onClick={() => setPendingTagFilters([])}
                      >
                        Clear selection
                      </button>
                      <button
                        type="button"
                        className="rounded-full bg-[color:var(--accent-600)] px-4 py-1 font-semibold text-white hover:bg-[color:var(--accent-500)]"
                        onClick={applyTagFilters}
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
          </div>
         
        </div>
        <button
              type="button"
              onClick={openCreateModal}
              className="w-full mt-5 rounded-xl bg-[color:var(--accent-600)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[color:var(--accent-500)]"
            >
              Add task
            </button>
      </div>

  
    </>
  );

  const toggleDescription = (taskId: string) => {
    setExpandedDescriptions((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  };
  const createPlannerDraft = (scheduledFor?: string) => {
    const base = createTaskDraft(defaultStartTime);
    return { ...base, scheduledFor: scheduledFor ?? getTodayISO() };
  };

  const openCreateModal = () => {
    setPlannerDraft(createPlannerDraft(selectedDate));
    setPlannerModal({ mode: 'create' });
    setPlannerError(null);
  };

  const openEditModal = (task: Task) => {
    setViewTaskId(null);
    setPlannerDraft(draftFromTask(task, defaultStartTime));
    setPlannerModal({ mode: 'edit', taskId: task.id });
    setPlannerError(null);
  };

  const closePlannerModal = () => {
    setPlannerModal(null);
    setPlannerError(null);
    setPlannerDraft(createPlannerDraft(selectedDate));
  };

  const plannerAllocation = useMemo(() => {
    if (!plannerModal) {
      return { assigned: 0, remaining: MINUTES_PER_DAY };
    }
    const scheduledFor = plannerDraft.scheduledFor || selectedDate;
    const excludeId = plannerModal.mode === 'edit' ? plannerModal.taskId : undefined;
    const assigned = getTotalAssignedMinutesForDate(tasks, scheduledFor, excludeId, {
      excludeCompleted: true
    });

    let capacityMinutes = MINUTES_PER_DAY;
    if (profile) {
      if (scheduledFor === today) {
        const progress = getDayProgress(profile.dayStartHour, profile.dayEndHour);
        capacityMinutes = Math.max(0, progress.minutesRemaining);
      } else {
        const rawSpan = profile.dayEndHour - profile.dayStartHour;
        const spanHours = rawSpan > 0 ? rawSpan : rawSpan + 24;
        capacityMinutes = Math.max(0, Math.min(24, spanHours) * 60);
      }
    }

    const remaining = Math.max(0, capacityMinutes - assigned);
    return { assigned, remaining };
  }, [plannerModal, plannerDraft.scheduledFor, tasks, selectedDate, profile, today]);

  const handlePlannerSubmit = () => {
    if (!plannerModal) {
      return;
    }
    setPlannerError(null);

    const trimmedTitle = plannerDraft.title.trim();
    if (!trimmedTitle) {
      setPlannerError('Give the task a name.');
      return;
    }

    const scheduledFor = plannerDraft.scheduledFor;
    const excludeId = plannerModal.mode === 'edit' ? plannerModal.taskId : undefined;
    const validation = validateSchedule(tasks, scheduledFor, plannerDraft, excludeId);
    if ('error' in validation) {
      setPlannerError(validation.error);
      return;
    }

    if (!canFitDuration(plannerAllocation.remaining, plannerDraft)) {
      setPlannerError('Task duration exceeds your remaining time for that day. Adjust duration or reschedule.');
      return;
    }

    const startAt = validation.startAt;
    const deadlineAt = validation.deadlineAt;
    const reminderAt = buildReminder(startAt, preferences.reminderLeadMinutes);

    if (plannerModal.mode === 'create') {
      actions.addTask({
        title: trimmedTitle,
        description: plannerDraft.description.trim() || undefined,
        scheduledFor,
        startAt,
        deadlineAt,
        reminderAt,
        durationMinutes: validation.durationMinutes,
        progressive: plannerDraft.progressive,
        tags: plannerDraft.tags
      });
    } else {
      actions.updateTask(plannerModal.taskId, {
        title: trimmedTitle,
        description: plannerDraft.description.trim() || undefined,
        scheduledFor,
        startAt,
        deadlineAt,
        reminderAt,
        durationMinutes: validation.durationMinutes,
        progressive: plannerDraft.progressive,
        tags: plannerDraft.tags
      });
    }

    closePlannerModal();
  };
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
              className={`rounded-full px-3 py-1 transition-colors ${rangeFilter === range
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
      </div>
          
      <FiltersPanel />


      {rangeFilter === 'today' && (
        <section className="space-y-4">
                      <div>
              <h2 className="text-lg font-semibold text-slate-200">{selectedDateLabel}</h2>
              <p className="text-xs text-slate-400">
                {selectedDayTasks.length} task{selectedDayTasks.length === 1 ? '' : 's'} • Assigned{' '}
                {formatMinutes(selectedDaySummary.assignedMinutes)} • Spent {formatMinutes(selectedDaySummary.spentMinutes)} • Active load{' '}
                {formatMinutes(selectedDayAllocation.assigned)} • Time left {formatMinutes(selectedDayAllocation.remaining)}
              </p>
            </div>
            {selectedDate !== today && <div className="flex items-center gap-2 text-xs text-slate-400">
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
            </div>}

          <div className="grid grid-cols-2 gap-3 text-xs text-slate-300 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <p className="text-[11px] uppercase text-slate-500">Planned</p>
              <p className="text-lg font-semibold text-slate-100">{selectedDaySummary.total}</p>
              <p className="text-[11px] text-slate-500">Time {formatMinutes(selectedDaySummary.statusMinutes.planned)}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <p className="text-[11px] uppercase text-slate-500">In progress</p>
              <p className="text-lg font-semibold text-sky-300">{selectedDaySummary.inProgress}</p>
              <p className="text-[11px] text-slate-500">Time {formatMinutes(selectedDaySummary.statusMinutes.in_progress)}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <p className="text-[11px] uppercase text-slate-500">Completed</p>
              <p className="text-lg font-semibold text-emerald-300">{selectedDaySummary.completed}</p>
              <p className="text-[11px] text-slate-500">Time {formatMinutes(selectedDaySummary.statusMinutes.completed)}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <p className="text-[11px] uppercase text-slate-500">Progressive</p>
              <p className="text-lg font-semibold text-amber-300">{selectedDaySummary.progressive}</p>
              <p className="text-[11px] text-slate-500">Time {formatMinutes(selectedDaySummary.progressiveMinutes)}</p>
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
                  const durationMinutes = getTaskDurationMinutes(task);
                  return (
                    <li
                      key={task.id}
                      className="rounded-2xl bg-slate-800/70 p-4 cursor-pointer"
                      onClick={() => setViewTaskId(task.id)}
                    >
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
                            {task.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 text-[11px] text-slate-300">
                                {task.tags.map((tag) => (
                                  <span key={tag} className="rounded-full bg-slate-700/80 px-2 py-0.5">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                            {task.description && (
                              <div className="pt-1">
                                <button
                                  type="button"
                                  className="flex items-center gap-2 text-xs text-[color:var(--accent-300)] hover:text-[color:var(--accent-200)]"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    toggleDescription(task.id);
                                  }}
                                >
                                  <span>Description…</span>
                                  <span>{expandedDescriptions[task.id] ? '▲' : '▼'}</span>
                                </button>
                                {expandedDescriptions[task.id] && (
                                  <div className="mt-2 rounded-xl   px-3 py-2">
                                    <MarkdownContent content={task.description} />
                                  </div>
                                )}
                              </div>
                            )}
                            <p className="text-xs text-slate-400">
                              {task.startAt ? `Starts ${timeLabel(task.startAt)}` : 'No start time'}
                              {task.deadlineAt ? ` • Deadline ${timeLabel(task.deadlineAt)}` : ''}
                              {durationMinutes ? ` • Duration ${formatMinutes(durationMinutes)}` : ''}
                              {task.reminderAt ? ` • Reminder ${timeLabel(task.reminderAt)}` : ''}
                            </p>
                          </div>
                          <div className="flex gap-2 text-xs" onClick={(event) => event.stopPropagation()}>
                            <button
                              className="rounded-lg bg-slate-700 px-3 py-1 text-slate-200"
                              onClick={() => openEditModal(task)}
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
                        <div className="flex flex-wrap gap-2 text-xs" onClick={(event) => event.stopPropagation()}>
                          {(['planned', 'in_progress', 'completed', 'skipped'] as TaskStatus[]).map((status) => (
                            <button
                              key={status}
                              type="button"
                              className={`rounded-full px-3 py-1 capitalize transition-colors ${task.status === status
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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
            {weekSummaries.map(({ date, iso, summary }) => {
              const isSelected = iso === selectedDate;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => goToDate(iso)}
                  className={`rounded-2xl border px-3 py-3 text-left transition-colors ${isSelected
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
                    <p>Assigned {formatMinutes(summary.assignedMinutes)}</p>
                    <p>Spent {formatMinutes(summary.spentMinutes)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {rangeFilter === 'month' && (
        <section className="space-y-4">
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
                    className={`rounded-xl border px-2 py-2 text-left transition-colors ${isSelected
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
                        <p>A {formatMinutes(summary.assignedMinutes)}</p>
                        <p>S {formatMinutes(summary.spentMinutes)}</p>
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
        <section className="space-y-4">
          {yearsSummary.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">
              No tasks recorded yet. Start planning to see yearly stats.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {yearsSummary.map(({ year, summary }) => (
                <button
                  key={year}
                  type="button"
                  onClick={() => goToYear(year)}
                  className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-left transition-colors hover:border-[color:var(--accent-500)]/70"
                >
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <h3 className="text-lg font-semibold text-slate-100">{year}</h3>
                    <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide">
                      View months <span>▸</span>
                    </span>
                  </div>
                  <div className="mt-3 space-y-1 text-[11px] text-slate-300">
                    <p>Total {summary.total}</p>
                    <p>Assigned {formatMinutes(summary.assignedMinutes)}</p>
                    <p>Spent {formatMinutes(summary.spentMinutes)}</p>
                    <p className="text-emerald-300">Completed {summary.completed}</p>
                    <p className="text-sky-300">In progress {summary.inProgress}</p>
                    <p className="text-amber-300">Progressive {summary.progressive}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      )}


      <TaskPlannerModal
        mode={plannerModal?.mode ?? 'create'}
        open={Boolean(plannerModal)}
        draft={plannerDraft}
        allocation={plannerAllocation}
        preferences={preferences}
        availableTags={taskTags}
        error={plannerError}
        onClose={closePlannerModal}
        onChange={(updates) => setPlannerDraft((prev) => ({ ...prev, ...updates }))}
        onSubmit={handlePlannerSubmit}
      />

      <TaskDetailsDialog
        task={viewTask}
        open={Boolean(viewTask)}
        onClose={() => setViewTaskId(null)}
        onEdit={(task) => openEditModal(task)}
      />
    </div>
  );
}
