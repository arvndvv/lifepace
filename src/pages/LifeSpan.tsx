import { differenceInYears, format } from 'date-fns';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppData } from '../context/AppDataContext';
import type { LifeGoalNode, ReflectionTag, ReminderSchedule, WeekWinEntry } from '../types';
import { buildLifeCalendar, type WeekCell } from '../utils/date';
import { createId } from '../utils/id';
import { GoalsGraph, GoalsGraphHandle } from '../components/GoalsGraph';
import { Portal } from '../components/Portal';

const CELL_SIZE = 12;
const CELL_GAP = 2;
const WEEKS_PER_ROW = 52;
const DEFAULT_FOCUS_RADIUS = 5;
const FOCUS_RADIUS_OPTIONS: number[] = [2, 5, 10];
const WIN_COLOR = '#38bdf8';
const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const GOALS_CANVAS = { width: 1200, height: 720 };

const STATUS_CLASS: Record<'past' | 'current' | 'future', string> = {
  past: 'bg-rose-500/80',
  current: 'bg-[color:var(--accent-400)]',
  future: 'bg-slate-800'
};

const REFLECTION_LABELS: Record<Exclude<ReflectionTag, 'none'>, string> = {
  learned: 'Learned something new',
  progressed: 'Made strong progress',
  advanced: 'Levelled up',
  enjoyed: 'Loved this week'
};

interface ReminderDraftForm {
  title: string;
  description: string;
  type: ReminderSchedule['type'];
  intervalMinutes: number;
  minuteMark: number;
  time: string;
  weeklyDays: number[];
  monthlyDays: string;
  yearlyDates: string;
}

interface MonthSegment {
  label: string;
  span: number;
}

type WeekSlot = WeekCell | null;

type LifeTab = 'timeline' | 'goals' | 'reminders';

const LEGEND_ITEMS = [
  { label: 'Past weeks', color: '#f43f5e' },
  { label: 'Current week', color: 'var(--accent-400)' },
  { label: 'Future weeks', color: '#1f2937' },
  { label: 'Wins', color: WIN_COLOR }
];

export default function LifeSpanPage() {
  const {
    state: {
      profile,
      lifeReflections,
      lifeWins,
      reminders,
      preferences,
      lifeGoals,
      lifeGoalLinks
    },
    autoWeekWins,
    actions: {
      setLifeReflection,
      setWeekWinManual,
      resetWeekWin,
      addReminder,
      deleteReminder,
      addLifeGoal,
      updateLifeGoal,
      deleteLifeGoal,
      connectLifeGoals,
      disconnectLifeGoals
    }
  } = useAppData();

  const [activeTab, setActiveTab] = useState<LifeTab>(() =>
    preferences.showLifeCalendar ? 'timeline' : 'goals'
  );
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'focus' | 'all'>(
    preferences.showLifeCalendar ? 'focus' : 'all'
  );
  const [focusRadius, setFocusRadius] = useState(DEFAULT_FOCUS_RADIUS);
  const [selectedWeek, setSelectedWeek] = useState<WeekCell | null>(null);
  const [modalTag, setModalTag] = useState<Exclude<ReflectionTag, 'none'>>('progressed');
  const [reminderDraft, setReminderDraft] = useState<ReminderDraftForm>({
    title: '',
    description: '',
    type: 'daily',
    intervalMinutes: 30,
    minuteMark: 0,
    time: '09:00',
    weeklyDays: [1],
    monthlyDays: '1',
    yearlyDates: '01-01'
  });
  const [reminderError, setReminderError] = useState<string | null>(null);
  const [gravity, setGravity] = useState(0.0025);
  const [goalModal, setGoalModal] = useState<
    | { mode: 'create'; parentId: string }
    | { mode: 'edit'; goalId: string }
    | null
  >(null);
  const [goalForm, setGoalForm] = useState({
    title: '',
    description: '',
    parentId: 'root',
    linkTargetId: 'root'
  });
  const graphRef = useRef<GoalsGraphHandle | null>(null);

  const exportGoalsImage = (canvas: HTMLCanvasElement) => {
    const data = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = data;
    link.download = 'lifepace-goals.png';
    link.click();
  };

  const handleGoalShare = () => {
    graphRef.current?.share();
  };

  useEffect(() => {
    if (!preferences.showLifeCalendar && activeTab === 'timeline') {
      setActiveTab('goals');
    }
  }, [preferences.showLifeCalendar, activeTab]);

  const handleTabChange = (tab: LifeTab) => {
    if (tab === 'timeline' && !preferences.showLifeCalendar) {
      setSnackbar('Enable "Weeks-of-life timeline" in Settings to view this tab.');
      setTimeout(() => setSnackbar(null), 4000);
      return;
    }
    setActiveTab(tab);
  };

  const calendar = useMemo(() => {
    if (!profile) {
      return [];
    }
    return buildLifeCalendar(profile.dateOfBirth, profile.lifeExpectancyYears);
  }, [profile]);

  const rows = useMemo(() => {
    if (calendar.length === 0) {
      return [];
    }
    const chunked: { yearIndex: number; weeks: WeekSlot[] }[] = [];
    for (let i = 0; i < calendar.length; i += WEEKS_PER_ROW) {
      const slice = calendar.slice(i, i + WEEKS_PER_ROW);
      const yearIndex = Math.floor(i / WEEKS_PER_ROW);
      chunked.push({ yearIndex, weeks: padRow(slice) });
    }
    return chunked;
  }, [calendar]);

  const gridStyle = useMemo(
    () => ({
      gridTemplateColumns: `repeat(${WEEKS_PER_ROW}, ${CELL_SIZE}px)`,
      columnGap: `${CELL_GAP}px`,
      rowGap: `${CELL_GAP}px`
    }),
    []
  );

  const visibleRows = useMemo(() => {
    if (activeTab !== 'timeline') {
      return [];
    }
    if (!profile || rows.length === 0) {
      return rows;
    }
    if (viewMode === 'all') {
      return rows;
    }
    const rawAge = differenceInYears(new Date(), new Date(profile.dateOfBirth));
    const ageYears = Math.max(0, rawAge);
    const cappedAge = Math.min(ageYears, Math.max(0, rows.length - 1));
    const start = Math.max(0, cappedAge - focusRadius);
    const end = Math.min(rows.length, cappedAge + focusRadius + 1);
    return rows.slice(start, end);
  }, [rows, profile, focusRadius, activeTab, viewMode]);

  const monthSegments = useMemo(
    () => (visibleRows.length > 0 ? buildMonthSegments(visibleRows[0].weeks) : []),
    [visibleRows]
  );

  const visibleStart = visibleRows[0]?.yearIndex ?? 0;
  const visibleEnd = visibleRows.at(-1)?.yearIndex ?? visibleStart;
  const rangeSummary =
    activeTab === 'timeline'
      ? viewMode === 'all'
        ? 'Entire lifespan'
        : `Age ${visibleStart}–${visibleEnd}`
      : '';

  useEffect(() => {
    if (!selectedWeek) {
      return;
    }
    const entry = lifeReflections[selectedWeek.id];
    const nextTag = entry?.tag && entry.tag !== 'none' ? entry.tag : 'progressed';
    setModalTag(nextTag);
  }, [selectedWeek, lifeReflections]);

  useEffect(() => {
    if (!selectedWeek) {
      return;
    }
    const stillVisible = visibleRows.some((row) =>
      row.weeks.some((week) => week && week.id === selectedWeek.id)
    );
    if (!stillVisible) {
      setSelectedWeek(null);
    }
  }, [visibleRows, selectedWeek]);

  const weeksLived = useMemo(
    () => calendar.filter((week) => week.status === 'past' || week.status === 'current').length,
    [calendar]
  );
  const totalWeeks = calendar.length;
  const weeksAhead = Math.max(totalWeeks - weeksLived, 0);
  const livedPercent = totalWeeks === 0 ? 0 : Math.min((weeksLived / totalWeeks) * 100, 100);

  const selectedWeekIsAuto = selectedWeek
    ? autoWeekWins.has(selectedWeek.id) && lifeWins[selectedWeek.id]?.status !== 'manual'
    : false;

  const rootGoal: LifeGoalNode = {
    id: 'root',
    title: profile?.name ? `${profile.name}` : 'You',
    description: undefined,
    x: GOALS_CANVAS.width / 2,
    y: GOALS_CANVAS.height / 2
  };

  const allGoals = useMemo(() => [rootGoal, ...lifeGoals], [rootGoal, lifeGoals]);

  useEffect(() => {
    if (!goalModal || goalModal.mode !== 'edit') {
      return;
    }
    const goal = lifeGoals.find((item) => item.id === goalModal.goalId);
    if (!goal) {
      setGoalModal(null);
      return;
    }
    const incoming = lifeGoalLinks.find((link) => link.targetId === goal.id);
    setGoalForm({
      title: goal.title,
      description: goal.description ?? '',
      parentId: incoming?.sourceId ?? 'root',
      linkTargetId: 'root'
    });
  }, [goalModal, lifeGoals, lifeGoalLinks]);

  const addReminderFromDraft = () => {
    setReminderError(null);
    if (!reminderDraft.title.trim()) {
      setReminderError('Give the reminder a title.');
      return;
    }
    let schedule: ReminderSchedule | null = null;
    switch (reminderDraft.type) {
      case 'every_minutes':
        schedule = {
          type: 'every_minutes',
          intervalMinutes: Math.max(1, reminderDraft.intervalMinutes)
        };
        break;
      case 'hourly':
        schedule = {
          type: 'hourly',
          minuteMark: Math.max(0, Math.min(59, reminderDraft.minuteMark))
        };
        break;
      case 'daily':
        schedule = { type: 'daily', time: reminderDraft.time };
        break;
      case 'weekly': {
        const days = reminderDraft.weeklyDays;
        if (days.length === 0) {
          setReminderError('Pick at least one day of the week.');
          return;
        }
        schedule = {
          type: 'weekly',
          daysOfWeek: Array.from(new Set(days)).sort((a, b) => a - b),
          time: reminderDraft.time
        };
        break;
      }
      case 'monthly': {
        const days = reminderDraft.monthlyDays
          .split(',')
          .map((part) => part.trim())
          .filter(Boolean)
          .map((value) => Number.parseInt(value, 10))
          .filter((value) => Number.isFinite(value) && value >= 1 && value <= 31);
        if (days.length === 0) {
          setReminderError('Enter one or more day numbers (1-31).');
          return;
        }
        schedule = {
          type: 'monthly',
          daysOfMonth: Array.from(new Set(days)).sort((a, b) => a - b),
          time: reminderDraft.time
        };
        break;
      }
      case 'yearly': {
        const dates = reminderDraft.yearlyDates
          .split(',')
          .map((part) => part.trim())
          .filter((part) => /^\d{2}-\d{2}$/.test(part));
        if (dates.length === 0) {
          setReminderError('Enter dates in MM-DD format.');
          return;
        }
        schedule = { type: 'yearly', dates: Array.from(new Set(dates)), time: reminderDraft.time };
        break;
      }
      default:
        schedule = null;
    }
    if (!schedule) {
      setReminderError('Unable to create reminder. Check your inputs.');
      return;
    }
    addReminder({
      title: reminderDraft.title.trim(),
      description: reminderDraft.description.trim() || undefined,
      schedule
    });
    setReminderDraft((prev) => ({
      ...prev,
      title: '',
      description: '',
      intervalMinutes: 30,
      minuteMark: 0,
      weeklyDays: prev.weeklyDays.length ? prev.weeklyDays : [1],
      monthlyDays: '1',
      yearlyDates: '01-01'
    }));
  };

  const goalById = useMemo(() => {
    const map = new Map<string, LifeGoalNode>();
    allGoals.forEach((goal) => map.set(goal.id, goal));
    return map;
  }, [allGoals]);

  const openCreateGoal = (parentId: string) => {
    setGoalForm({ title: '', description: '', parentId, linkTargetId: 'root' });
    setGoalModal({ mode: 'create', parentId });
  };

  const activeGoal = goalModal?.mode === 'edit' ? goalById.get(goalModal.goalId) ?? null : null;
  const parentOptions = goalModal?.mode === 'edit'
    ? allGoals.filter((goal) => goal.id !== goalModal.goalId)
    : allGoals;

  const ensureLink = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) {
      return;
    }
    const exists = lifeGoalLinks.some((link) => link.sourceId === sourceId && link.targetId === targetId);
    if (!exists) {
      connectLifeGoals(sourceId, targetId);
    }
  };

  const replaceParentLink = (goalId: string, parentId: string) => {
    lifeGoalLinks
      .filter((link) => link.targetId === goalId)
      .forEach((link) => disconnectLifeGoals(link.id));
    ensureLink(parentId, goalId);
  };

  const closeGoalModal = () => {
    setGoalModal(null);
    setGoalForm({ title: '', description: '', parentId: 'root', linkTargetId: 'root' });
  };

  const handleSaveGoal = () => {
    if (!activeGoal || !goalForm.title.trim()) {
      return;
    }
    updateLifeGoal(activeGoal.id, {
      title: goalForm.title.trim(),
      description: goalForm.description.trim() || undefined
    });
    replaceParentLink(activeGoal.id, goalForm.parentId);
    if (goalForm.linkTargetId && goalForm.linkTargetId !== 'root') {
      ensureLink(activeGoal.id, goalForm.linkTargetId);
      setGoalForm((prev) => ({ ...prev, linkTargetId: 'root' }));
    }
    closeGoalModal();
  };

  const handleCreateGoal = () => {
    if (goalModal?.mode !== 'create') {
      return;
    }
    if (!goalForm.title.trim()) {
      return;
    }
    const parent = goalById.get(goalModal.parentId) ?? rootGoal;
    const angle = Math.random() * Math.PI * 2;
    const radius = 200 + Math.random() * 120;
    const x = clamp(parent.x + Math.cos(angle) * radius, 80, GOALS_CANVAS.width - 80);
    const y = clamp(parent.y + Math.sin(angle) * radius, 80, GOALS_CANVAS.height - 80);
    const newId = createId();
    addLifeGoal({ id: newId, title: goalForm.title.trim(), description: goalForm.description.trim() || undefined, position: { x, y } });
    ensureLink(goalModal.parentId, newId);
    if (goalForm.linkTargetId && goalForm.linkTargetId !== 'root') {
      ensureLink(newId, goalForm.linkTargetId);
    }
    closeGoalModal();
  };

  const handleDeleteGoal = (goalId: string) => {
    deleteLifeGoal(goalId);
    closeGoalModal();
  };

  const handleSaveManualWin = (tag: Exclude<ReflectionTag, 'none'>) => {
    if (!selectedWeek) {
      return;
    }
    setLifeReflection(selectedWeek.id, tag, WIN_COLOR);
    setWeekWinManual(selectedWeek.id, true);
    setSelectedWeek(null);
  };

  const handleClearWin = () => {
    if (!selectedWeek) {
      return;
    }
    setLifeReflection(selectedWeek.id, 'none');
    resetWeekWin(selectedWeek.id);
    setSelectedWeek(null);
  };

  if (!profile) {
    return <p className="text-sm text-slate-400">Complete onboarding to generate your lifespan view.</p>;
  }

  const timelineHidden = !preferences.showLifeCalendar;

  return (
    <div className="space-y-6">
      <nav className="flex gap-2 text-sm">
        {(
          [
            { key: 'timeline', label: 'Weeks of life' },
            { key: 'goals', label: 'Goals map' },
            { key: 'reminders', label: 'Reminders' }
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`rounded-lg px-4 py-2 transition-colors ${
              activeTab === tab.key
                ? 'bg-[color:var(--accent-600)] text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
            onClick={() => handleTabChange(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === 'timeline' && (
        timelineHidden ? (
          <p className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-sm text-slate-400">
            You have hidden the weeks-of-life timeline in settings. Toggle it back on to see your calendar here.
          </p>
        ) : (
          <>
            <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
              <h2 className="text-xl font-semibold text-slate-100">Weeks of your life</h2>
              <p className="mt-2 text-sm text-slate-400">
                {profile.name}, we&apos;re mapping from your birthday to {profile.lifeExpectancyYears}. Every cell is one week. Rose squares are weeks you have lived, the bright highlight is this week, and grey blocks are still ahead.
              </p>
              <div className="mt-5 grid gap-4 text-sm text-slate-200 grid-cols-3 md:grid-cols-3">
                <div className="rounded-2xl bg-slate-900/70 p-4">
                  <p className="text-xs uppercase text-slate-400">Weeks lived</p>
                  <p className="text-2xl font-semibold text-[color:var(--accent-300)]">{weeksLived.toLocaleString()}</p>
                </div>
                <div className="rounded-2xl bg-slate-900/70 p-4">
                  <p className="text-xs uppercase text-slate-400">Weeks ahead</p>
                  <p className="text-2xl font-semibold text-[color:var(--accent-300)]">{weeksAhead.toLocaleString()}</p>
                </div>
                <div className="rounded-2xl bg-slate-900/70 p-4 md:col-span-1">
                  <p className="text-xs uppercase text-slate-400">Story so far</p>
                  <p className="text-2xl font-semibold text-slate-100">{livedPercent.toFixed(1)}%</p>
                </div>
              </div>
            </section>

            <section className="space-y-4 overflow-x-auto rounded-3xl border border-slate-800 bg-slate-900/80 p-4 shadow-lg">
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <div className="inline-flex rounded-full bg-slate-900/60 p-1">
                  <button
                    type="button"
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      viewMode === 'focus'
                        ? 'bg-[color:var(--accent-600)] text-white shadow-[0_14px_34px_-20px_var(--accent-shadow-strong)]'
                        : 'text-slate-300 hover:bg-slate-800/70'
                    }`}
                    onClick={() => {
                      setViewMode('focus');
                      setFocusRadius(DEFAULT_FOCUS_RADIUS);
                    }}
                  >
                    Focus ±{DEFAULT_FOCUS_RADIUS}y
                  </button>
                  <button
                    type="button"
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      viewMode === 'all'
                        ? 'bg-[color:var(--accent-600)] text-white shadow-[0_14px_34px_-20px_var(--accent-shadow-strong)]'
                        : 'text-slate-300 hover:bg-slate-800/70'
                    }`}
                    onClick={() => setViewMode('all')}
                  >
                    Whole life
                  </button>
                </div>
                <span className="text-xs text-slate-400">{rangeSummary}</span>
              </div>

              {viewMode === 'focus' && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>Span</span>
                  <div className="inline-flex rounded-full bg-slate-900/50 p-0.5">
                    {FOCUS_RADIUS_OPTIONS.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setFocusRadius(option)}
                        className={`rounded-full px-2.5 py-1 transition-colors ${
                          focusRadius === option
                            ? 'bg-[color:var(--accent-600)] text-white shadow-[0_10px_28px_-18px_var(--accent-shadow-strong)]'
                            : 'text-slate-300 hover:bg-slate-800/70'
                        }`}
                        aria-pressed={focusRadius === option}
                      >
                        ±{option}y
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-300">
                {LEGEND_ITEMS.map((item) => (
                  <span key={item.label} className="flex items-center gap-1">
                    <span
                      className="inline-block h-3 w-3 rounded-sm"
                      style={{ background: item.color }}
                    />
                    {item.label}
                  </span>
                ))}
              </div>

              {monthSegments.length > 0 && (
                <div className="flex gap-2">
                  <span className="block w-9 flex-shrink-0 sm:w-11 md:w-20" />
                  <div className="grid items-end text-[11px] uppercase tracking-wide text-slate-300" style={gridStyle}>
                    {monthSegments.map((segment, index) => (
                      <span
                        key={`${segment.label || 'empty'}-${index}`}
                        className="pb-1 text-center font-semibold"
                        style={{ gridColumn: `span ${segment.span}` }}
                      >
                        {segment.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2">
                {visibleRows.map((row) => (
                  <div key={row.yearIndex} className="flex items-start gap-2">
                    <span className="flex-shrink-0 text-right text-[11px] font-medium text-slate-400 whitespace-nowrap w-9 sm:w-11 md:w-20 md:uppercase md:tracking-wide">
                      <span className="hidden md:inline">Age </span>
                      {row.yearIndex}
                    </span>
                    <div className="grid" style={gridStyle}>
                      {row.weeks.map((cell, cellIndex) => {
                        if (!cell) {
                          return (
                            <div
                              key={`empty-${row.yearIndex}-${cellIndex}`}
                              className="rounded-[2px] bg-slate-900/40"
                              style={{ width: `${CELL_SIZE}px`, height: `${CELL_SIZE}px` }}
                            />
                          );
                        }
                        const entry = lifeReflections[cell.id];
                        const reflectionTag = entry?.tag && entry.tag !== 'none' ? entry.tag : undefined;
                        const winEntry: WeekWinEntry | undefined = lifeWins[cell.id];
                        const manualWin = winEntry?.status === 'manual' && winEntry.fulfilled;
                        const autoWin = autoWeekWins.has(cell.id);
                        const isWin = manualWin || autoWin || Boolean(reflectionTag);
                        const buttonClass = [
                          'rounded-[3px] transition-transform duration-150 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-ring)] focus:ring-offset-2 focus:ring-offset-slate-900',
                          isWin ? '' : STATUS_CLASS[cell.status],
                          cell.status !== 'future' ? 'cursor-pointer hover:scale-110' : 'cursor-pointer'
                        ]
                          .filter(Boolean)
                          .join(' ');
                        const displayColor = isWin ? WIN_COLOR : undefined;
                        const tooltipBase = reflectionTag
                          ? `${format(cell.start, 'MMM d, yyyy')} • ${REFLECTION_LABELS[reflectionTag]}`
                          : `${format(cell.start, 'MMM d, yyyy')} • ${cell.status}`;
                        const tooltip = autoWin ? `${tooltipBase} • Auto-marked win` : tooltipBase;
                        return (
                          <button
                            key={cell.id}
                            type="button"
                            className={buttonClass}
                            style={{
                              width: `${CELL_SIZE}px`,
                              height: `${CELL_SIZE}px`,
                              background: displayColor,
                              boxShadow: displayColor ? `0 12px 32px -18px ${WIN_COLOR}55` : undefined
                            }}
                            title={tooltip}
                            onClick={() => {
                              if (cell.status === 'future') {
                                return;
                              }
                              setSelectedWeek(cell);
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {selectedWeek && (
              <Portal>
                <div
                  className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm px-4 py-6"
                  onClick={() => setSelectedWeek(null)}
                >
                  <div
                    className="w-full max-w-md rounded-2xl bg-slate-900 p-6 text-sm shadow-xl"
                    onClick={(event) => event.stopPropagation()}
                  >
                  <header className="flex items-start justify-between">
                    <div>
                      <p className="text-xs uppercase text-slate-500">Week of</p>
                      <p className="text-lg font-semibold text-slate-100">{format(selectedWeek.start, 'MMM d, yyyy')}</p>
                      {autoWeekWins.has(selectedWeek.id) && (
                        <p className="mt-2 rounded bg-[color:var(--accent-600)]/20 px-2 py-1 text-xs text-[color:var(--accent-200)]">
                          Auto-marked win • earned by meeting your progressive goal.
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300 hover:bg-slate-700"
                      onClick={() => setSelectedWeek(null)}
                    >
                      Close
                    </button>
                  </header>

                  <div className="mt-4 space-y-3">
                    <button
                      type="button"
                      disabled
                      className={`w-full cursor-default rounded-lg border px-3 py-2 text-left text-sm ${
                        autoWeekWins.has(selectedWeek.id)
                          ? 'border-[color:var(--accent-500)] bg-[color:var(--accent-500)]/10 text-[color:var(--accent-200)]'
                          : 'border-slate-700 bg-slate-900/60 text-slate-400'
                      }`}
                    >
                      Auto-marked win (progress goals)
                    </button>
                    {(['learned', 'progressed', 'advanced', 'enjoyed'] as Exclude<ReflectionTag, 'none'>[]).map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                          modalTag === value
                            ? 'border-[color:var(--accent-500)] bg-[color:var(--accent-500)]/10 text-white'
                            : 'border-slate-700 bg-slate-900/60 text-slate-200 hover:border-[color:var(--accent-500)]/50'
                        }`}
                        onClick={() => setModalTag(value)}
                      >
                        <span className="block font-semibold">{REFLECTION_LABELS[value]}</span>
                      </button>
                    ))}
                  </div>

                  <div className="mt-6 flex justify-between gap-2">
                    <button
                      type="button"
                      className="rounded-lg px-3 py-2 text-xs text-slate-300 hover:text-white"
                      onClick={handleClearWin}
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      className="rounded-lg bg-[color:var(--accent-600)] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[color:var(--accent-500)]"
                      onClick={() => handleSaveManualWin(modalTag)}
                    >
                      Save win
                    </button>
                  </div>
                  </div>
                </div>
              </Portal>
            )}
          </>
        )
      )}

      {activeTab === 'goals' && (
        <section className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-lg">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Goals map</h2>
              <p className="text-xs text-slate-400">
                Your ambitions orbit gently. Nodes keep their distance automatically—click any dot to edit.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
              <label className="flex items-center gap-2">
                <span>Gravity</span>
                <input
                  type="range"
                  min={0.0005}
                  max={0.01}
                  step={0.0005}
                  value={gravity}
                  onChange={(event) => setGravity(Number.parseFloat(event.target.value))}
                />
                <span className="w-10 text-right text-[10px] text-slate-500">
                  {gravity.toFixed(3)}
                </span>
              </label>
              <button
                type="button"
                className="rounded-full bg-[color:var(--accent-600)] px-3 py-1 text-white hover:bg-[color:var(--accent-500)]"
                onClick={() => openCreateGoal('root')}
              >
                Add goal
              </button>
              <button
                type="button"
                className="rounded-full bg-slate-800 px-3 py-1 text-slate-200 hover:bg-slate-700"
                onClick={handleGoalShare}
              >
                Share image
              </button>
            </div>
          </header>
          <GoalsGraph
            ref={graphRef}
            nodes={allGoals}
            links={lifeGoalLinks}
            onSelectGoal={(id) => {
              if (id === 'root') {
                openCreateGoal('root');
              } else {
                setGoalModal({ mode: 'edit', goalId: id });
              }
            }}
            width={GOALS_CANVAS.width}
            height={GOALS_CANVAS.height}
            isRoot={(id) => id === 'root'}
            gravity={gravity}
            onShare={exportGoalsImage}
          />
        </section>
      )}

      {goalModal?.mode === 'create' && (
        <Portal>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur">
            <div className="w-full max-w-lg rounded-2xl bg-slate-900 p-6 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-100">Add goal</h2>
                <button
                  type="button"
                  className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300 hover:bg-slate-700"
                  onClick={closeGoalModal}
                >
                  Cancel
                </button>
              </div>
              <form
                className="space-y-3 text-sm"
                onSubmit={(event) => {
                  event.preventDefault();
                  handleCreateGoal();
                }}
              >
                <label className="space-y-1">
                  <span className="text-xs uppercase text-slate-400">Title</span>
                  <input
                    className="w-full rounded-lg bg-slate-800 px-3 py-2 text-slate-100"
                    value={goalForm.title}
                    onChange={(event) => setGoalForm((prev) => ({ ...prev, title: event.target.value }))}
                    required
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs uppercase text-slate-400">Description</span>
                  <textarea
                    className="w-full rounded-lg bg-slate-800 px-3 py-2 text-slate-100"
                    rows={3}
                    value={goalForm.description}
                    onChange={(event) => setGoalForm((prev) => ({ ...prev, description: event.target.value }))}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs uppercase text-slate-400">Belongs to</span>
                  <select
                    className="w-full rounded-lg bg-slate-800 px-3 py-2"
                    value={goalForm.parentId}
                    onChange={(event) => setGoalForm((prev) => ({ ...prev, parentId: event.target.value }))}
                  >
                    {allGoals.map((goal) => (
                      <option key={goal.id} value={goal.id}>
                        {goal.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-xs uppercase text-slate-400">Also link to (optional)</span>
                  <select
                    className="w-full rounded-lg bg-slate-800 px-3 py-2"
                    value={goalForm.linkTargetId}
                    onChange={(event) => setGoalForm((prev) => ({ ...prev, linkTargetId: event.target.value }))}
                  >
                    <option value="root">Select goal</option>
                    {allGoals
                      .filter((goal) => goal.id !== goalForm.parentId)
                      .map((goal) => (
                        <option key={goal.id} value={goal.id}>
                          {goal.title}
                        </option>
                      ))}
                  </select>
                </label>
                <div className="flex justify-end gap-2">
                  <button
                    type="submit"
                    className="rounded-lg bg-[color:var(--accent-600)] px-4 py-2 text-xs font-semibold text-white hover:bg-[color:var(--accent-500)]"
                  >
                    Save goal
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Portal>
      )}

      {goalModal?.mode === 'edit' && activeGoal && (
        <Portal>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur">
            <div className="w-full max-w-xl rounded-2xl bg-slate-900 p-6 text-sm text-slate-200 shadow-xl">
              <header className="mb-4 flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Edit goal</h2>
                  <p className="text-xs text-slate-400">Adjust the goal, connect branches, or add subgoals.</p>
                </div>
                <div className="flex gap-2 text-xs">
                  <button
                    type="button"
                    className="rounded bg-slate-800 px-3 py-1 text-slate-300 hover:bg-slate-700"
                    onClick={() => openCreateGoal(activeGoal.id)}
                  >
                    Add subgoal
                  </button>
                  <button
                    type="button"
                    className="rounded bg-rose-500/20 px-3 py-1 text-rose-200 hover:bg-rose-500/30"
                    onClick={() => handleDeleteGoal(activeGoal.id)}
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    className="rounded bg-slate-800 px-3 py-1 text-slate-300 hover:bg-slate-700"
                    onClick={closeGoalModal}
                  >
                    Close
                  </button>
                </div>
              </header>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-xs uppercase text-slate-400">Title</span>
                  <input
                    className="w-full rounded-lg bg-slate-800 px-3 py-2"
                    value={goalForm.title}
                    onChange={(event) => setGoalForm((prev) => ({ ...prev, title: event.target.value }))}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs uppercase text-slate-400">Belongs to</span>
                  <select
                    className="w-full rounded-lg bg-slate-800 px-3 py-2"
                    value={goalForm.parentId}
                    onChange={(event) => setGoalForm((prev) => ({ ...prev, parentId: event.target.value }))}
                  >
                    {parentOptions.map((goal) => (
                      <option key={goal.id} value={goal.id}>
                        {goal.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="mt-3 block space-y-1">
                <span className="text-xs uppercase text-slate-400">Description</span>
                <textarea
                  className="w-full rounded-lg bg-slate-800 px-3 py-2"
                  rows={3}
                  value={goalForm.description}
                  onChange={(event) => setGoalForm((prev) => ({ ...prev, description: event.target.value }))}
                />
              </label>

              <div className="mt-4 flex flex-wrap items-end gap-2 text-xs">
                <label className="space-y-1">
                  <span className="text-xs uppercase text-slate-400">Connect goal to…</span>
                  <select
                    className="rounded-lg bg-slate-800 px-3 py-2"
                    value={goalForm.linkTargetId}
                    onChange={(event) => setGoalForm((prev) => ({ ...prev, linkTargetId: event.target.value }))}
                  >
                    <option value="root">Select goal</option>
                    {allGoals
                      .filter((goal) => goal.id !== activeGoal.id)
                      .map((goal) => (
                        <option key={goal.id} value={goal.id}>
                          {goal.title}
                        </option>
                      ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="h-9 rounded bg-slate-800 px-3 text-xs text-slate-200 hover:bg-slate-700"
                  onClick={() => {
                    if (goalForm.linkTargetId && goalForm.linkTargetId !== 'root') {
                      ensureLink(activeGoal.id, goalForm.linkTargetId);
                      setGoalForm((prev) => ({ ...prev, linkTargetId: 'root' }));
                    }
                  }}
                >
                  Connect
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-3 text-xs">
                {lifeGoalLinks
                  .filter((link) => link.sourceId === activeGoal.id)
                  .map((link) => {
                    const target = goalById.get(link.targetId);
                    if (!target) {
                      return null;
                    }
                    return (
                      <span key={link.id} className="inline-flex items-center gap-2 rounded-full bg-slate-800 px-3 py-1">
                        {target.title}
                        <button
                          type="button"
                          onClick={() => disconnectLifeGoals(link.id)}
                          className="text-slate-400 hover:text-white"
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-[color:var(--accent-600)] px-4 py-2 text-xs font-semibold text-white hover:bg-[color:var(--accent-500)]"
                  onClick={handleSaveGoal}
                >
                  Save changes
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {activeTab === 'reminders' && (
        <section className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Recurring reminders</h2>
              <p className="text-xs text-slate-400">Create gentle nudges for habits, check-ins, or rituals.</p>
            </div>
          </div>

          <form
            className="space-y-3 rounded-2xl bg-slate-900/70 p-4"
            onSubmit={(event) => {
              event.preventDefault();
              addReminderFromDraft();
            }}
          >
            <input
              className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-100"
              placeholder="Reminder title"
              value={reminderDraft.title}
              onChange={(event) => setReminderDraft((prev) => ({ ...prev, title: event.target.value }))}
              required
            />
            <textarea
              className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-100"
              placeholder="Optional description"
              value={reminderDraft.description}
              onChange={(event) => setReminderDraft((prev) => ({ ...prev, description: event.target.value }))}
              rows={2}
            />
            <div className="grid gap-3 text-sm md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs uppercase text-slate-400">Repeat pattern</span>
                <select
                  className="w-full rounded-lg bg-slate-900 px-3 py-2"
                  value={reminderDraft.type}
                  onChange={(event) =>
                    setReminderDraft((prev) => ({
                      ...prev,
                      type: event.target.value as ReminderSchedule['type']
                    }))
                  }
                >
                  <option value="every_minutes">Every N minutes</option>
                  <option value="hourly">Every hour</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </label>
              {reminderDraft.type === 'every_minutes' && (
                <label className="space-y-1">
                  <span className="text-xs uppercase text-slate-400">Interval (minutes)</span>
                  <input
                    type="number"
                    min={1}
                    max={24 * 60}
                    className="w-full rounded-lg bg-slate-900 px-3 py-2"
                    value={reminderDraft.intervalMinutes}
                    onChange={(event) =>
                      setReminderDraft((prev) => ({
                        ...prev,
                        intervalMinutes: Number.parseInt(event.target.value, 10) || 1
                      }))
                    }
                  />
                </label>
              )}
              {reminderDraft.type === 'hourly' && (
                <label className="space-y-1">
                  <span className="text-xs uppercase text-slate-400">Minute mark</span>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    className="w-full rounded-lg bg-slate-900 px-3 py-2"
                    value={reminderDraft.minuteMark}
                    onChange={(event) =>
                      setReminderDraft((prev) => ({
                        ...prev,
                        minuteMark: Number.parseInt(event.target.value, 10) || 0
                      }))
                    }
                  />
                </label>
              )}
              {['daily', 'weekly', 'monthly', 'yearly'].includes(reminderDraft.type) && (
                <label className="space-y-1">
                  <span className="text-xs uppercase text-slate-400">Time of day</span>
                  <input
                    type="time"
                    className="w-full rounded-lg bg-slate-900 px-3 py-2"
                    value={reminderDraft.time}
                    onChange={(event) =>
                      setReminderDraft((prev) => ({ ...prev, time: event.target.value }))
                    }
                  />
                </label>
              )}
            </div>
            {reminderDraft.type === 'weekly' && (
              <div className="rounded-lg bg-slate-900/60 p-3 text-xs text-slate-300">
                <p className="mb-2 font-semibold">Days of the week</p>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAY_LABELS.map((label, index) => {
                    const active = reminderDraft.weeklyDays.includes(index);
                    return (
                      <button
                        key={label}
                        type="button"
                        className={`rounded-full px-3 py-1 transition-colors ${
                          active ? 'bg-[color:var(--accent-600)] text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                        onClick={() =>
                          setReminderDraft((prev) => ({
                            ...prev,
                            weeklyDays: active
                              ? prev.weeklyDays.filter((day) => day !== index)
                              : [...prev.weeklyDays, index]
                          }))
                        }
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {reminderDraft.type === 'monthly' && (
              <label className="space-y-1 text-xs text-slate-400">
                <span>Days of month (comma separated)</span>
                <input
                  className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-100"
                  value={reminderDraft.monthlyDays}
                  onChange={(event) => setReminderDraft((prev) => ({ ...prev, monthlyDays: event.target.value }))}
                />
              </label>
            )}
            {reminderDraft.type === 'yearly' && (
              <label className="space-y-1 text-xs text-slate-400">
                <span>Dates (comma separated MM-DD)</span>
                <input
                  className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-100"
                  value={reminderDraft.yearlyDates}
                  onChange={(event) => setReminderDraft((prev) => ({ ...prev, yearlyDates: event.target.value }))}
                />
              </label>
            )}
            {reminderError && <p className="text-xs text-rose-300">{reminderError}</p>}
            <div className="flex justify-end">
              <button
                type="submit"
                className="rounded-lg bg-[color:var(--accent-600)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[color:var(--accent-500)]"
              >
                Save reminder
              </button>
            </div>
          </form>

          <div className="space-y-2">
            {reminders.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">
                No reminders yet. Add one above to get started.
              </p>
            ) : (
              reminders.map((reminder) => (
                <div
                  key={reminder.id}
                  className="flex flex-col gap-2 rounded-2xl bg-slate-800/70 p-4 text-sm text-slate-200 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="font-semibold text-slate-100">{reminder.title}</p>
                    {reminder.description && <p className="text-xs text-slate-400">{reminder.description}</p>}
                    <p className="text-xs text-slate-400">{formatReminderSchedule(reminder.schedule)}</p>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <button
                      type="button"
                      className="rounded-lg bg-slate-700 px-3 py-1 text-rose-300"
                      onClick={() => deleteReminder(reminder.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {snackbar && (
        <Portal>
          <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900/90 px-4 py-2 text-xs text-slate-200 shadow-lg">
            {snackbar}
          </div>
        </Portal>
      )}
    </div>
  );
}

function padRow(row: WeekCell[]): WeekSlot[] {
  const result: WeekSlot[] = row.slice(0, WEEKS_PER_ROW);
  while (result.length < WEEKS_PER_ROW) {
    result.push(null);
  }
  return result;
}

function buildMonthSegments(row: WeekSlot[]): MonthSegment[] {
  if (row.length === 0) {
    return [];
  }
  const segments: MonthSegment[] = [];
  let currentLabel: string | null = null;
  let span = 0;
  row.forEach((cell) => {
    const label = cell ? format(cell.start, 'MMM') : '';
    if (label !== currentLabel) {
      if (span > 0) {
        segments.push({ label: currentLabel ?? '', span });
      }
      currentLabel = label;
      span = 1;
    } else {
      span += 1;
    }
  });
  if (span > 0) {
    segments.push({ label: currentLabel ?? '', span });
  }
  return segments;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function formatReminderSchedule(schedule: ReminderSchedule): string {
  switch (schedule.type) {
    case 'every_minutes':
      return `Every ${schedule.intervalMinutes} minutes`;
    case 'hourly':
      return `Hourly at minute ${schedule.minuteMark}`;
    case 'daily':
      return `Daily at ${schedule.time}`;
    case 'weekly':
      return `Weekly on ${schedule.daysOfWeek.map((day) => WEEKDAY_LABELS[day]).join(', ')} at ${schedule.time}`;
    case 'monthly':
      return `Monthly on days ${schedule.daysOfMonth.join(', ')} at ${schedule.time}`;
    case 'yearly':
      return `Yearly on ${schedule.dates.join(', ')} at ${schedule.time}`;
    default:
      return 'Custom reminder';
  }
}
