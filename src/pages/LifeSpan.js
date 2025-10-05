import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { differenceInYears, format } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import { useAppData } from '../context/AppDataContext';
import { buildLifeCalendar } from '../utils/date';
const CELL_SIZE = 12; // px
const CELL_GAP = 2; // px
const WEEKS_PER_ROW = 52;
const DEFAULT_FOCUS_RADIUS = 5;
const FOCUS_RADIUS_OPTIONS = [2, 5, 10];
const STATUS_CLASS = {
    past: 'bg-rose-500/80',
    current: 'bg-[color:var(--accent-400)]',
    future: 'bg-slate-800'
};
const REFLECTION_LABELS = {
    learned: 'Learned something new',
    progressed: 'Made strong progress',
    advanced: 'Levelled up',
    enjoyed: 'Loved this week'
};
const REFLECTION_DEFAULT_COLORS = {
    learned: '#34d399',
    progressed: '#38bdf8',
    advanced: '#a855f7',
    enjoyed: '#facc15'
};
function hexToRGBA(hex, alpha) {
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
function shadowForColor(color) {
    return `0 12px 32px -18px ${hexToRGBA(color, 0.55)}`;
}
function padRow(row) {
    const result = row.slice(0, WEEKS_PER_ROW);
    while (result.length < WEEKS_PER_ROW) {
        result.push(null);
    }
    return result;
}
function buildMonthSegments(row) {
    if (row.length === 0) {
        return [];
    }
    const segments = [];
    let currentLabel = null;
    let span = 0;
    row.forEach((cell) => {
        const label = cell ? format(cell.start, 'MMM') : '';
        if (label !== currentLabel) {
            if (span > 0) {
                segments.push({ label: currentLabel ?? '', span });
            }
            currentLabel = label;
            span = 1;
        }
        else {
            span += 1;
        }
    });
    if (span > 0) {
        segments.push({ label: currentLabel ?? '', span });
    }
    return segments;
}
export default function LifeSpanPage() {
    const { state: { profile, lifeReflections }, actions: { setLifeReflection } } = useAppData();
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
        const chunked = [];
        for (let i = 0; i < calendar.length; i += WEEKS_PER_ROW) {
            const slice = calendar.slice(i, i + WEEKS_PER_ROW);
            const yearIndex = Math.floor(i / WEEKS_PER_ROW);
            chunked.push({ yearIndex, weeks: padRow(slice) });
        }
        return chunked;
    }, [calendar]);
    const weeksLived = useMemo(() => calendar.filter((week) => week.status === 'past' || week.status === 'current').length, [calendar]);
    const totalWeeks = calendar.length;
    const weeksAhead = Math.max(totalWeeks - weeksLived, 0);
    const livedPercent = totalWeeks === 0 ? 0 : Math.min((weeksLived / totalWeeks) * 100, 100);
    const gridStyle = useMemo(() => ({
        gridTemplateColumns: `repeat(${WEEKS_PER_ROW}, ${CELL_SIZE}px)`,
        columnGap: `${CELL_GAP}px`,
        rowGap: `${CELL_GAP}px`
    }), []);
    const [viewMode, setViewMode] = useState('focus');
    const [focusRadius, setFocusRadius] = useState(DEFAULT_FOCUS_RADIUS);
    const [selectedWeek, setSelectedWeek] = useState(null);
    const [modalTag, setModalTag] = useState('learned');
    const [modalColor, setModalColor] = useState(REFLECTION_DEFAULT_COLORS.learned);
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
    const monthSegments = useMemo(() => (visibleRows.length > 0 ? buildMonthSegments(visibleRows[0].weeks) : []), [visibleRows]);
    const visibleStart = visibleRows[0]?.yearIndex ?? 0;
    const visibleEnd = visibleRows.at(-1)?.yearIndex ?? visibleStart;
    const rangeSummary = viewMode === 'all' ? 'Entire lifespan' : `Age ${visibleStart}–${visibleEnd}`;
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
        const stillVisible = visibleRows.some((row) => row.weeks.some((week) => week && week.id === selectedWeek.id));
        if (!stillVisible) {
            setSelectedWeek(null);
        }
    }, [visibleRows, selectedWeek]);
    const reflectionOptions = [
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
        return _jsx("p", { className: "text-sm text-slate-400", children: "Complete onboarding to generate your lifespan view." });
    }
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("section", { className: "rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl", children: [_jsx("h2", { className: "text-xl font-semibold text-slate-100", children: "Weeks of your life" }), _jsxs("p", { className: "mt-2 text-sm text-slate-400", children: [profile.name, ", we're mapping from your birthday to ", profile.lifeExpectancyYears, ". Every cell is one week. Rose squares are weeks you have lived, the bright highlight is this week, and grey blocks are still ahead."] }), _jsxs("div", { className: "mt-5 grid gap-4 text-sm text-slate-200 md:grid-cols-3", children: [_jsxs("div", { className: "rounded-2xl bg-slate-900/70 p-4", children: [_jsx("p", { className: "text-xs uppercase text-slate-400", children: "Weeks lived" }), _jsx("p", { className: "text-2xl font-semibold text-[color:var(--accent-300)]", children: weeksLived.toLocaleString() })] }), _jsxs("div", { className: "rounded-2xl bg-slate-900/70 p-4", children: [_jsx("p", { className: "text-xs uppercase text-slate-400", children: "Weeks ahead" }), _jsx("p", { className: "text-2xl font-semibold text-[color:var(--accent-300)]", children: weeksAhead.toLocaleString() })] }), _jsxs("div", { className: "rounded-2xl bg-slate-900/70 p-4 md:col-span-1", children: [_jsx("p", { className: "text-xs uppercase text-slate-400", children: "Story so far" }), _jsxs("p", { className: "text-2xl font-semibold text-slate-100", children: [livedPercent.toFixed(1), "%"] }), _jsx("p", { className: "mt-2 text-xs text-slate-400", children: "Keep choosing moments you'll be proud to paint into the grid." })] })] })] }), _jsxs("section", { className: "space-y-3 overflow-x-auto rounded-3xl border border-slate-800 bg-slate-900/80 p-4 shadow-lg", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3 text-sm", children: [_jsxs("div", { className: "inline-flex rounded-full bg-slate-900/60 p-1", children: [_jsxs("button", { type: "button", className: `rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === 'focus'
                                            ? 'bg-[color:var(--accent-600)] text-white shadow-[0_14px_34px_-20px_var(--accent-shadow-strong)]'
                                            : 'text-slate-300 hover:bg-slate-800/70'}`, onClick: () => setViewMode('focus'), "aria-pressed": viewMode === 'focus', children: ["Focus \u00B1", focusRadius, "y"] }), _jsx("button", { type: "button", className: `rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === 'all'
                                            ? 'bg-[color:var(--accent-600)] text-white shadow-[0_14px_34px_-20px_var(--accent-shadow-strong)]'
                                            : 'text-slate-300 hover:bg-slate-800/70'}`, onClick: () => setViewMode('all'), "aria-pressed": viewMode === 'all', children: "Whole life" })] }), _jsx("span", { className: "text-xs text-slate-400", children: rangeSummary })] }), viewMode === 'focus' && visibleRows.length > 0 && (_jsxs("p", { className: "text-xs text-slate-500", children: ["Focus shows \u00B1", focusRadius, " years around your current age. Switch to the whole-life view anytime."] })), viewMode === 'focus' && visibleRows.length > 0 && (_jsxs("div", { className: "flex items-center gap-2 text-xs text-slate-500", children: [_jsx("span", { children: "Span" }), _jsx("div", { className: "inline-flex rounded-full bg-slate-900/50 p-0.5", children: FOCUS_RADIUS_OPTIONS.map((option) => (_jsxs("button", { type: "button", onClick: () => setFocusRadius(option), className: `rounded-full px-2.5 py-1 transition-colors ${focusRadius === option
                                        ? 'bg-[color:var(--accent-600)] text-white shadow-[0_10px_28px_-18px_var(--accent-shadow-strong)]'
                                        : 'text-slate-300 hover:bg-slate-800/70'}`, "aria-pressed": focusRadius === option, title: `Show ±${option} years around today`, children: ["\u00B1", option, "y"] }, option))) })] })), monthSegments.length > 0 && (_jsxs("div", { className: "flex gap-2", children: [_jsx("span", { className: "block w-9 flex-shrink-0 sm:w-11 md:w-20" }), _jsx("div", { className: "grid items-end text-[11px] uppercase tracking-wide text-slate-300", style: gridStyle, children: monthSegments.map((segment, index) => (_jsx("span", { className: "pb-1 text-center font-semibold", style: { gridColumn: `span ${segment.span}` }, children: segment.label }, `${segment.label || 'empty'}-${index}`))) })] })), _jsx("div", { className: "flex flex-col gap-2", children: visibleRows.map((row) => (_jsxs("div", { className: "flex items-start gap-2", children: [_jsxs("span", { className: "flex-shrink-0 text-right text-[11px] font-medium text-slate-400 whitespace-nowrap w-9 sm:w-11 md:w-20 md:uppercase md:tracking-wide", children: [_jsx("span", { className: "hidden md:inline", children: "Age " }), row.yearIndex] }), _jsx("div", { className: "grid", style: gridStyle, children: row.weeks.map((cell, cellIndex) => {
                                        if (!cell) {
                                            return (_jsx("div", { className: "rounded-[2px] bg-slate-900/40", style: { width: `${CELL_SIZE}px`, height: `${CELL_SIZE}px` } }, `empty-${row.yearIndex}-${cellIndex}`));
                                        }
                                        const entry = lifeReflections[cell.id];
                                        const reflectionTag = entry?.tag;
                                        const hasReflection = reflectionTag !== undefined && reflectionTag !== 'none';
                                        const customColor = entry?.color;
                                        const fallbackColor = reflectionTag && reflectionTag !== 'none'
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
                                        return (_jsx("button", { type: "button", className: buttonClass, style: {
                                                width: `${CELL_SIZE}px`,
                                                height: `${CELL_SIZE}px`,
                                                background: hasReflection ? displayColor : undefined,
                                                boxShadow: hasReflection ? boxShadow : undefined
                                            }, title: hasReflection && reflectionTag
                                                ? `${format(cell.start, 'MMM d, yyyy')} • ${REFLECTION_LABELS[reflectionTag]}`
                                                : `${format(cell.start, 'MMM d, yyyy')} • ${cell.status}`, onClick: () => {
                                                if (!canTag) {
                                                    return;
                                                }
                                                setSelectedWeek(cell);
                                            } }, cell.id));
                                    }) })] }, row.yearIndex))) })] }), selectedWeek && (_jsx("div", { className: "fixed inset-0 z-40 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm px-4 py-6", onClick: () => setSelectedWeek(null), children: _jsxs("div", { className: "w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/95 p-5 shadow-2xl max-h-[min(80vh,420px)] overflow-y-auto", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "mb-4 flex items-start justify-between gap-3", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Week of" }), _jsx("p", { className: "text-lg font-semibold text-slate-100", children: format(selectedWeek.start, 'MMM d, yyyy') })] }), _jsx("button", { type: "button", className: "rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 transition-colors hover:bg-slate-800", onClick: handleClearReflection, children: "Clear" })] }), _jsx("div", { className: "grid gap-2", children: reflectionOptions.map((option) => {
                                const active = modalTag === option.value;
                                const fallback = REFLECTION_DEFAULT_COLORS[option.value];
                                return (_jsxs("button", { type: "button", className: `flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-left transition-colors ${active ? 'ring-2 ring-offset-2 ring-[color:var(--accent-ring)] ring-offset-slate-900 border-[color:var(--accent-500)]' : 'hover:border-slate-700'}`, onClick: () => {
                                        setModalTag(option.value);
                                        setModalColor((prev) => (active ? prev : fallback));
                                    }, "aria-pressed": active, children: [_jsxs("div", { children: [_jsx("p", { className: "font-medium text-slate-100", children: option.label }), _jsx("p", { className: "text-xs text-slate-400", children: option.helper })] }), active && _jsx("span", { className: "text-sm text-[color:var(--accent-300)]", children: "Selected" })] }, option.value));
                            }) }), _jsxs("div", { className: "mt-4 space-y-2", children: [_jsx("label", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Tag colour" }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("input", { type: "color", value: modalColor, onChange: (event) => setModalColor(event.target.value), className: "h-10 w-14 cursor-pointer rounded border border-slate-700 bg-slate-900" }), _jsx("button", { type: "button", className: "text-xs text-[color:var(--accent-300)] underline-offset-4 hover:underline", onClick: () => setModalColor(REFLECTION_DEFAULT_COLORS[modalTag] ?? REFLECTION_DEFAULT_COLORS.learned), children: "Reset to default" })] })] }), _jsxs("div", { className: "mt-6 flex justify-end gap-2", children: [_jsx("button", { type: "button", className: "rounded-full border border-slate-700 px-4 py-2 text-xs text-slate-300 transition-colors hover:bg-slate-800", onClick: () => setSelectedWeek(null), children: "Cancel" }), _jsx("button", { type: "button", className: "rounded-full bg-[color:var(--accent-600)] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[color:var(--accent-500)]", onClick: handleSaveReflection, children: "Save tag" })] })] }) })), _jsxs("section", { className: "flex flex-wrap items-center gap-4 text-sm text-slate-300", children: [_jsxs("span", { className: "flex items-center gap-2", children: [_jsx("span", { className: "h-3 w-3 rounded-sm bg-slate-800" }), " Future weeks"] }), _jsxs("span", { className: "flex items-center gap-2", children: [_jsx("span", { className: "h-3 w-3 rounded-sm bg-rose-500/80" }), " Weeks lived"] }), _jsxs("span", { className: "flex items-center gap-2", children: [_jsx("span", { className: "h-3 w-3 rounded-sm", style: { background: REFLECTION_DEFAULT_COLORS.learned } }), " Tagged wins"] }), _jsxs("span", { className: "flex items-center gap-2", children: [_jsx("span", { className: "h-3 w-3 rounded-sm bg-[color:var(--accent-400)]" }), " Current week"] })] })] }));
}
