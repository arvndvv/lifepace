import { differenceInYears, format } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import { useAppData } from '../context/AppDataContext';
import type { ReflectionEntry, ReflectionTag } from '../types';
import { buildLifeCalendar, type WeekCell } from '../utils/date';

const CELL_SIZE = 12; // px
const CELL_GAP = 2; // px
const WEEKS_PER_ROW = 52;

const DEFAULT_FOCUS_RADIUS = 5;
const FOCUS_RADIUS_OPTIONS: number[] = [2, 5, 10];

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

const REFLECTION_DEFAULT_COLORS: Record<Exclude<ReflectionTag, 'none'>, string> = {
  learned: '#34d399',
  progressed: '#38bdf8',
  advanced: '#a855f7',
  enjoyed: '#facc15'
};

function hexToRGBA(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) {
    return hex;
  }
  const bigint = Number.parseInt(normalized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function shadowForColor(color: string): string {
  return `0 12px 32px -18px ${hexToRGBA(color, 0.55)}`;
}

type WeekSlot = WeekCell | null;

interface MonthSegment {
  label: string;
  span: number;
}

interface YearRow {
  yearIndex: number;
  weeks: WeekSlot[];
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

export default function LifeSpanPage() {
  const {
    state: { profile, lifeReflections },
    actions: { setLifeReflection }
  } = useAppData();

  const calendar = useMemo(() => {
    if (!profile) {
      return [];
    }
    return buildLifeCalendar(profile.dateOfBirth, profile.lifeExpectancyYears);
  }, [profile]);

  const rows = useMemo<YearRow[]>(() => {
    if (calendar.length === 0) {
      return [];
    }
    const chunked: YearRow[] = [];
    for (let i = 0; i < calendar.length; i += WEEKS_PER_ROW) {
      const slice = calendar.slice(i, i + WEEKS_PER_ROW);
      const yearIndex = Math.floor(i / WEEKS_PER_ROW);
      chunked.push({ yearIndex, weeks: padRow(slice) });
    }
    return chunked;
  }, [calendar]);

  const weeksLived = useMemo(
    () => calendar.filter((week) => week.status === 'past' || week.status === 'current').length,
    [calendar]
  );
  const totalWeeks = calendar.length;
  const weeksAhead = Math.max(totalWeeks - weeksLived, 0);
  const livedPercent = totalWeeks === 0 ? 0 : Math.min((weeksLived / totalWeeks) * 100, 100);

  const gridStyle = useMemo(
    () => ({
      gridTemplateColumns: `repeat(${WEEKS_PER_ROW}, ${CELL_SIZE}px)`,
      columnGap: `${CELL_GAP}px`,
      rowGap: `${CELL_GAP}px`
    }),
    []
  );

  const [viewMode, setViewMode] = useState<'focus' | 'all'>('focus');
  const [focusRadius, setFocusRadius] = useState(DEFAULT_FOCUS_RADIUS);
  const [selectedWeek, setSelectedWeek] = useState<WeekCell | null>(null);
  const [modalTag, setModalTag] = useState<Exclude<ReflectionTag, 'none'>>('learned');
  const [modalColor, setModalColor] = useState<string>(REFLECTION_DEFAULT_COLORS.learned);

  const visibleRows = useMemo(() => {
    if (viewMode === 'all') {
      return rows;
    }
    if (!profile || rows.length === 0) {
      return rows;
    }
    const rawAge = differenceInYears(new Date(), new Date(profile.dateOfBirth));
    const ageYears = Math.max(0, rawAge);
    const cappedAge = Math.min(ageYears, Math.max(0, rows.length - 1));
    const start = Math.max(0, cappedAge - focusRadius);
    const end = Math.min(rows.length, cappedAge + focusRadius + 1);
    return rows.slice(start, end);
  }, [rows, viewMode, profile, focusRadius]);

  const monthSegments = useMemo(
    () => (visibleRows.length > 0 ? buildMonthSegments(visibleRows[0].weeks) : []),
    [visibleRows]
  );

  const visibleStart = visibleRows[0]?.yearIndex ?? 0;
  const visibleEnd = visibleRows.at(-1)?.yearIndex ?? visibleStart;
  const rangeSummary =
    viewMode === 'all' ? 'Entire lifespan' : `Age ${visibleStart}–${visibleEnd}`;

  useEffect(() => {
    if (!selectedWeek) {
      return;
    }
    const entry = lifeReflections[selectedWeek.id];
    const nextTag = entry?.tag && entry.tag !== 'none' ? entry.tag : 'learned';
    const fallbackColor = entry?.color ?? REFLECTION_DEFAULT_COLORS[nextTag] ?? REFLECTION_DEFAULT_COLORS.learned;
    setModalTag(nextTag);
    setModalColor(entry?.color ?? fallbackColor);
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

  const reflectionOptions: { value: Exclude<ReflectionTag, 'none'>; label: string; helper: string }[] = [
    { value: 'learned', label: 'Learned', helper: 'Something new clicked' },
    { value: 'progressed', label: 'Progressed', helper: 'Moved a needle forward' },
    { value: 'advanced', label: 'Advanced', helper: 'Levelled up your skills' },
    { value: 'enjoyed', label: 'Enjoyed', helper: 'Sparked joy or rest' }
  ];

  const handleSaveReflection = () => {
    if (!selectedWeek) {
      return;
    }
    const defaultColor = REFLECTION_DEFAULT_COLORS[modalTag];
    const colorToSave = defaultColor && modalColor.toLowerCase() === defaultColor.toLowerCase() ? undefined : modalColor;
    setLifeReflection(selectedWeek.id, modalTag, colorToSave);
    setSelectedWeek(null);
  };

  const handleClearReflection = () => {
    if (!selectedWeek) {
      return;
    }
    setLifeReflection(selectedWeek.id, 'none');
    setSelectedWeek(null);
  };

  if (!profile) {
    return <p className="text-sm text-slate-400">Complete onboarding to generate your lifespan view.</p>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
        <h2 className="text-xl font-semibold text-slate-100">Weeks of your life</h2>
        <p className="mt-2 text-sm text-slate-400">
          {profile.name}, we&apos;re mapping from your birthday to {profile.lifeExpectancyYears}. Every cell is one week. Rose squares are weeks you have lived, the bright highlight is this week, and grey blocks are still ahead.
        </p>
        <div className="mt-5 grid gap-4 text-sm text-slate-200  grid-cols-3 md:grid-cols-3">
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
            <p className="mt-2 text-xs text-slate-400 hidden">Keep choosing moments you&apos;ll be proud to paint into the grid.</p>
          </div>
        </div>
      </section>

      <section className="space-y-3 overflow-x-auto rounded-3xl border border-slate-800 bg-slate-900/80 p-4 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="inline-flex rounded-full bg-slate-900/60 p-1">
            <button
              type="button"
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'focus'
                  ? 'bg-[color:var(--accent-600)] text-white shadow-[0_14px_34px_-20px_var(--accent-shadow-strong)]'
                  : 'text-slate-300 hover:bg-slate-800/70'
              }`}
              onClick={() => setViewMode('focus')}
              aria-pressed={viewMode === 'focus'}
            >
              Focus ±{focusRadius}y
            </button>
            <button
              type="button"
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'all'
                  ? 'bg-[color:var(--accent-600)] text-white shadow-[0_14px_34px_-20px_var(--accent-shadow-strong)]'
                  : 'text-slate-300 hover:bg-slate-800/70'
              }`}
              onClick={() => setViewMode('all')}
              aria-pressed={viewMode === 'all'}
            >
              Whole life
            </button>
          </div>
          <span className="text-xs text-slate-400">{rangeSummary}</span>
        </div>
        {viewMode === 'focus' && visibleRows.length > 0 && (
          <p className="text-xs text-slate-500">
            Focus shows ±{focusRadius} years around your current age. Switch to the whole-life view anytime.
          </p>
        )}
        {viewMode === 'focus' && visibleRows.length > 0 && (
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
                  title={`Show ±${option} years around today`}
                >
                  ±{option}y
                </button>
              ))}
            </div>
          </div>
        )}

        {monthSegments.length > 0 && (
          <div className="flex gap-2">
            <span className="block w-9 flex-shrink-0 sm:w-11 md:w-20" />
            <div
              className="grid items-end text-[11px] uppercase tracking-wide text-slate-300"
              style={gridStyle}
            >
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
                  const reflectionTag = entry?.tag;
                  const hasReflection = reflectionTag !== undefined && reflectionTag !== 'none';
                  const customColor = entry?.color;
                  const fallbackColor =
                    reflectionTag && reflectionTag !== 'none'
                      ? REFLECTION_DEFAULT_COLORS[reflectionTag]
                      : undefined;
                  const displayColor = hasReflection ? customColor ?? fallbackColor ?? REFLECTION_DEFAULT_COLORS.learned : undefined;
                  const boxShadow = displayColor ? shadowForColor(displayColor) : undefined;
                  const canTag = cell.status === 'past' || cell.status === 'current';

                  const buttonClass = [
                    'rounded-[3px] transition-transform duration-150 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-ring)] focus:ring-offset-2 focus:ring-offset-slate-900',
                    canTag ? 'cursor-pointer hover:scale-110' : '',
                    hasReflection ? '' : STATUS_CLASS[cell.status]
                  ]
                    .filter(Boolean)
                    .join(' ');

                  return (
                    <button
                      key={cell.id}
                      type="button"
                      className={buttonClass}
                      style={{
                        width: `${CELL_SIZE}px`,
                        height: `${CELL_SIZE}px`,
                        background: hasReflection ? displayColor : undefined,
                        boxShadow: hasReflection ? boxShadow : undefined
                      }}
                      title={
                        hasReflection && reflectionTag
                          ? `${format(cell.start, 'MMM d, yyyy')} • ${REFLECTION_LABELS[reflectionTag]}`
                          : `${format(cell.start, 'MMM d, yyyy')} • ${cell.status}`
                      }
                      onClick={() => {
                        if (!canTag) {
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
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm px-4 py-6"
          onClick={() => setSelectedWeek(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/95 p-5 shadow-2xl max-h-[min(80vh,420px)] overflow-y-auto"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Week of</p>
                <p className="text-lg font-semibold text-slate-100">{format(selectedWeek.start, 'MMM d, yyyy')}</p>
              </div>
              <button
                type="button"
                className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 transition-colors hover:bg-slate-800"
                onClick={handleClearReflection}
              >
                Clear
              </button>
            </div>
            <div className="grid gap-2">
              {reflectionOptions.map((option) => {
                const active = modalTag === option.value;
                const fallback = REFLECTION_DEFAULT_COLORS[option.value];
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-left transition-colors ${
                      active ? 'ring-2 ring-offset-2 ring-[color:var(--accent-ring)] ring-offset-slate-900 border-[color:var(--accent-500)]' : 'hover:border-slate-700'
                    }`}
                    onClick={() => {
                      setModalTag(option.value);
                      setModalColor((prev) => (active ? prev : fallback));
                    }}
                    aria-pressed={active}
                  >
                    <div>
                      <p className="font-medium text-slate-100">{option.label}</p>
                      <p className="text-xs text-slate-400">{option.helper}</p>
                    </div>
                    {active && <span className="text-sm text-[color:var(--accent-300)]">Selected</span>}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 space-y-2">
              <label className="text-xs uppercase tracking-wide text-slate-400">Tag colour</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={modalColor}
                  onChange={(event) => setModalColor(event.target.value)}
                  className="h-10 w-14 cursor-pointer rounded border border-slate-700 bg-slate-900"
                />
                <button
                  type="button"
                  className="text-xs text-[color:var(--accent-300)] underline-offset-4 hover:underline"
                  onClick={() => setModalColor(REFLECTION_DEFAULT_COLORS[modalTag] ?? REFLECTION_DEFAULT_COLORS.learned)}
                >
                  Reset to default
                </button>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-full border border-slate-700 px-4 py-2 text-xs text-slate-300 transition-colors hover:bg-slate-800"
                onClick={() => setSelectedWeek(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-full bg-[color:var(--accent-600)] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[color:var(--accent-500)]"
                onClick={handleSaveReflection}
              >
                Save tag
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="flex flex-wrap items-center gap-4 text-sm text-slate-300">
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-slate-800" /> Future weeks
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-rose-500/80" /> Weeks lived
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm" style={{ background: REFLECTION_DEFAULT_COLORS.learned }} /> Tagged wins
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-[color:var(--accent-400)]" /> Current week
        </span>
      </section>
    </div>
  );
}

