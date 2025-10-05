import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from 'react';
import { useAppData } from '../context/AppDataContext';
import { getPeriodRanges } from '../utils/date';
import { buildTaskSummary } from '../utils/stats';
export default function StatsPage() {
    const { state: { tasks } } = useAppData();
    const ranges = useMemo(() => getPeriodRanges(new Date()), []);
    const weekly = useMemo(() => buildTaskSummary(tasks, ranges.week), [tasks, ranges.week]);
    const monthly = useMemo(() => buildTaskSummary(tasks, ranges.month), [tasks, ranges.month]);
    const yearly = useMemo(() => buildTaskSummary(tasks, ranges.year), [tasks, ranges.year]);
    const summaries = [
        { label: 'This week', data: weekly },
        { label: 'This month', data: monthly },
        { label: 'This year', data: yearly }
    ];
    return (_jsx("div", { className: "space-y-4", children: summaries.map((item) => (_jsxs("section", { className: "rounded-2xl bg-slate-800/70 p-4 shadow", children: [_jsxs("header", { className: "mb-3 flex items-center justify-between", children: [_jsx("h2", { className: "text-lg font-semibold", children: item.label }), _jsxs("span", { className: "text-xs text-slate-400", children: [item.data.total, " tasks"] })] }), _jsxs("dl", { className: "grid grid-cols-2 gap-4 text-sm", children: [_jsxs("div", { children: [_jsx("dt", { className: "text-slate-400", children: "Completed" }), _jsx("dd", { className: "text-xl font-semibold text-emerald-400", children: item.data.counts.completed })] }), _jsxs("div", { children: [_jsx("dt", { className: "text-slate-400", children: "In progress" }), _jsx("dd", { className: "text-xl font-semibold text-amber-300", children: item.data.counts.in_progress })] }), _jsxs("div", { children: [_jsx("dt", { className: "text-slate-400", children: "Planned" }), _jsx("dd", { className: "text-xl font-semibold text-slate-200", children: item.data.counts.planned })] }), _jsxs("div", { children: [_jsx("dt", { className: "text-slate-400", children: "Skipped" }), _jsx("dd", { className: "text-xl font-semibold text-rose-300", children: item.data.counts.skipped })] })] }), _jsxs("div", { className: "mt-4 grid grid-cols-3 gap-3 text-xs text-slate-400", children: [_jsxs("div", { className: "rounded-lg bg-slate-900/70 p-3", children: [_jsx("p", { className: "text-slate-300", children: "Completion rate" }), _jsxs("p", { className: "text-lg font-semibold text-emerald-400", children: [(item.data.completionRate * 100).toFixed(0), "%"] })] }), _jsxs("div", { className: "rounded-lg bg-slate-900/70 p-3", children: [_jsx("p", { className: "text-slate-300", children: "Started" }), _jsxs("p", { className: "text-lg font-semibold text-amber-300", children: [(item.data.startedRate * 100).toFixed(0), "%"] })] }), _jsxs("div", { className: "rounded-lg bg-slate-900/70 p-3", children: [_jsx("p", { className: "text-slate-300", children: "Dropped" }), _jsxs("p", { className: "text-lg font-semibold text-rose-300", children: [(item.data.droppedRate * 100).toFixed(0), "%"] })] })] })] }, item.label))) }));
}
