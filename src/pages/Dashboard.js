import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { format, parseISO } from 'date-fns';
import { useMemo } from 'react';
import { useAppData } from '../context/AppDataContext';
import { getDayProgress, getTodayISO } from '../utils/date';
export default function DashboardPage() {
    const { state: { profile, tasks }, actions } = useAppData();
    const dayProgress = profile
        ? getDayProgress(profile.dayStartHour, profile.dayEndHour)
        : { totalMinutes: 0, minutesElapsed: 0, minutesRemaining: 0, percentElapsed: 0 };
    const today = getTodayISO();
    const todayTasks = useMemo(() => tasks
        .filter((task) => task.scheduledFor === today)
        .sort((a, b) => {
        const aStart = a.startAt ?? '';
        const bStart = b.startAt ?? '';
        return aStart.localeCompare(bStart);
    }), [tasks, today]);
    if (!profile) {
        return (_jsxs("div", { className: "space-y-4", children: [_jsx("h2", { className: "text-lg font-semibold", children: "Let's set up your profile" }), _jsx("p", { className: "text-sm text-slate-400", children: "Complete onboarding to start tracking your time." })] }));
    }
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("section", { className: "rounded-2xl bg-slate-800/60 p-4 shadow-lg", children: [_jsxs("header", { className: "mb-3 flex items-center justify-between text-sm text-slate-300", children: [_jsx("span", { children: "Today" }), _jsx("span", { children: format(new Date(), 'EEEE, MMM d') })] }), _jsxs("div", { className: "space-y-3", children: [_jsx("div", { className: "h-3 w-full overflow-hidden rounded-full bg-slate-700", children: _jsx("div", { className: "h-3 rounded-full bg-[color:var(--accent-500)] transition-all", style: { width: `${dayProgress.percentElapsed}%` } }) }), _jsxs("div", { className: "flex items-center justify-between text-xs text-slate-400", children: [_jsxs("div", { children: [_jsxs("p", { className: "font-semibold text-slate-200", children: [Math.round(dayProgress.percentElapsed), "% done"] }), _jsxs("p", { children: [Math.round(dayProgress.minutesRemaining / 60), " hours left"] })] }), _jsxs("div", { className: "text-right", children: [_jsxs("p", { className: "font-semibold text-slate-200", children: [Math.round(dayProgress.minutesElapsed / 60), " hours spent"] }), _jsxs("p", { children: ["Total ", (dayProgress.totalMinutes / 60).toFixed(1), " hours"] })] })] })] })] }), _jsxs("section", { className: "space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "text-lg font-semibold", children: "Today's tasks" }), _jsxs("span", { className: "text-xs text-slate-400", children: [todayTasks.length, " scheduled"] })] }), _jsxs("ul", { className: "space-y-2", children: [todayTasks.length === 0 && (_jsx("li", { className: "rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-400", children: "Plan something meaningful for today." })), todayTasks.map((task) => (_jsxs("li", { className: "flex items-start justify-between gap-3 rounded-2xl bg-slate-800/70 p-4", children: [_jsxs("div", { className: "space-y-1", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("h3", { className: "font-medium text-slate-100", children: task.title }), _jsx("span", { className: "rounded-full bg-slate-700 px-2 py-0.5 text-[11px] uppercase text-slate-300", children: task.status.replace('_', ' ') })] }), task.description && _jsx("p", { className: "text-sm text-slate-300", children: task.description }), _jsxs("p", { className: "text-xs text-slate-400", children: [task.startAt ? `Starts ${format(parseISO(task.startAt), 'p')}` : 'Start time not set', task.deadlineAt ? ` • Deadline ${format(parseISO(task.deadlineAt), 'p')}` : '', task.reminderAt ? ` • Reminder ${format(parseISO(task.reminderAt), 'p')}` : ''] })] }), _jsx("div", { className: "flex flex-col items-end gap-1 text-xs", children: ['planned', 'in_progress', 'completed', 'skipped'].map((status) => (_jsx("button", { className: `rounded-full px-3 py-1 capitalize transition-colors ${task.status === status
                                                ? 'bg-[color:var(--accent-600)] text-white'
                                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`, onClick: () => actions.setTaskStatus(task.id, status), children: status.replace('_', ' ') }, status))) })] }, task.id)))] })] })] }));
}
