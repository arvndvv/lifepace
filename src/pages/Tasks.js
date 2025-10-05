import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { useAppData } from '../context/AppDataContext';
import { getTodayISO } from '../utils/date';
function combineDateTime(dateISO, time) {
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
function timeLabel(iso) {
    if (!iso) {
        return null;
    }
    return format(parseISO(iso), 'p');
}
function computeReminder(startAt, leadMinutes) {
    if (!startAt) {
        return undefined;
    }
    if (leadMinutes <= 0) {
        return startAt;
    }
    const start = new Date(startAt);
    const reminder = new Date(start.getTime() - leadMinutes * 60 * 1000);
    return reminder.toISOString();
}
export default function TasksPage() {
    const { state: { tasks, preferences }, actions } = useAppData();
    const defaultStartTime = preferences.defaultReminderTime ?? '09:00';
    const [draft, setDraft] = useState({
        title: '',
        description: '',
        scheduledFor: getTodayISO(),
        startTime: defaultStartTime,
        deadlineTime: ''
    });
    const [formError, setFormError] = useState(null);
    const [infoMessage, setInfoMessage] = useState(null);
    const [editingTaskId, setEditingTaskId] = useState(null);
    const [editDraft, setEditDraft] = useState(null);
    const [editError, setEditError] = useState(null);
    const byDate = useMemo(() => {
        const grouped = new Map();
        tasks
            .slice()
            .sort((a, b) => {
            const dateCompare = a.scheduledFor.localeCompare(b.scheduledFor);
            if (dateCompare !== 0) {
                return dateCompare;
            }
            const aStart = a.startAt ?? '';
            const bStart = b.startAt ?? '';
            return aStart.localeCompare(bStart);
        })
            .forEach((task) => {
            const list = grouped.get(task.scheduledFor) ?? [];
            list.push(task);
            grouped.set(task.scheduledFor, list);
        });
        return Array.from(grouped.entries());
    }, [tasks]);
    const resetDraft = () => setDraft({
        title: '',
        description: '',
        scheduledFor: getTodayISO(),
        startTime: defaultStartTime,
        deadlineTime: ''
    });
    const validateStartAndDeadline = (title, scheduledFor, startTime, deadlineTime, excludeId) => {
        if (!startTime) {
            return { error: 'Choose when this task starts.' };
        }
        const startAt = combineDateTime(scheduledFor, startTime);
        if (!startAt) {
            return { error: 'Start time is invalid.' };
        }
        const deadlineAt = deadlineTime ? combineDateTime(scheduledFor, deadlineTime) : undefined;
        if (deadlineAt && new Date(deadlineAt) <= new Date(startAt)) {
            return { error: 'Deadline must be after the start time.' };
        }
        const sameStart = tasks.find((task) => task.id !== excludeId &&
            task.scheduledFor === scheduledFor &&
            task.startAt &&
            new Date(task.startAt).getTime() === new Date(startAt).getTime());
        if (sameStart) {
            return {
                error: `“${sameStart.title}” already starts at ${timeLabel(sameStart.startAt)}.`
            };
        }
        const overlappingDeadlines = tasks.filter((task) => {
            if (task.id === excludeId) {
                return false;
            }
            if (task.scheduledFor !== scheduledFor) {
                return false;
            }
            if (!task.startAt || !task.deadlineAt) {
                return false;
            }
            const start = new Date(task.startAt).getTime();
            const end = new Date(task.deadlineAt).getTime();
            const candidateStart = new Date(startAt).getTime();
            return candidateStart > start && candidateStart < end;
        });
        return { startAt, deadlineAt, overlappingDeadlines };
    };
    const handleSubmit = (event) => {
        event.preventDefault();
        setFormError(null);
        setInfoMessage(null);
        if (!draft.title.trim()) {
            setFormError('Give the task a name.');
            return;
        }
        const validation = validateStartAndDeadline(draft.title, draft.scheduledFor, draft.startTime, draft.deadlineTime);
        if ('error' in validation) {
            setFormError(validation.error ?? null);
            return;
        }
        const reminderAt = computeReminder(validation.startAt, preferences.reminderLeadMinutes);
        actions.addTask({
            title: draft.title.trim(),
            description: draft.description.trim() || undefined,
            scheduledFor: draft.scheduledFor,
            startAt: validation.startAt,
            deadlineAt: validation.deadlineAt,
            reminderAt
        });
        if (validation.overlappingDeadlines && validation.overlappingDeadlines.length > 0) {
            const conflict = validation.overlappingDeadlines[0];
            setInfoMessage(`Heads up: “${conflict.title}” is planned until ${timeLabel(conflict.deadlineAt)}. Consider adjusting one of the tasks if they compete for your focus.`);
        }
        else {
            setInfoMessage(null);
        }
        resetDraft();
    };
    const startEdit = (taskId) => {
        const task = tasks.find((item) => item.id === taskId);
        if (!task) {
            return;
        }
        setEditingTaskId(task.id);
        setEditError(null);
        setEditDraft({
            title: task.title,
            description: task.description ?? '',
            scheduledFor: task.scheduledFor,
            startTime: task.startAt ? format(parseISO(task.startAt), 'HH:mm') : defaultStartTime,
            deadlineTime: task.deadlineAt ? format(parseISO(task.deadlineAt), 'HH:mm') : ''
        });
    };
    const submitEdit = (event) => {
        event.preventDefault();
        if (!editingTaskId || !editDraft) {
            return;
        }
        setEditError(null);
        if (!editDraft.title.trim()) {
            setEditError('Task name cannot be empty.');
            return;
        }
        const validation = validateStartAndDeadline(editDraft.title, editDraft.scheduledFor, editDraft.startTime, editDraft.deadlineTime, editingTaskId);
        if ('error' in validation) {
            setEditError(validation.error ?? null);
            return;
        }
        const reminderAt = computeReminder(validation.startAt, preferences.reminderLeadMinutes);
        actions.updateTask(editingTaskId, {
            title: editDraft.title.trim(),
            description: editDraft.description.trim() || undefined,
            scheduledFor: editDraft.scheduledFor,
            startAt: validation.startAt,
            deadlineAt: validation.deadlineAt,
            reminderAt
        });
        setEditingTaskId(null);
        setEditDraft(null);
    };
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("section", { className: "rounded-2xl bg-slate-800/70 p-4 shadow-lg", children: [_jsx("h2", { className: "mb-4 text-lg font-semibold", children: "Plan a task" }), _jsxs("form", { className: "space-y-3", onSubmit: handleSubmit, children: [_jsx("input", { className: "w-full rounded-lg bg-slate-900 px-3 py-2 text-sm", placeholder: "What will you do?", value: draft.title, onChange: (event) => setDraft((prev) => ({ ...prev, title: event.target.value })), required: true }), _jsx("textarea", { className: "w-full rounded-lg bg-slate-900 px-3 py-2 text-sm", placeholder: "Add an optional note", value: draft.description, onChange: (event) => setDraft((prev) => ({ ...prev, description: event.target.value })), rows: 3 }), _jsxs("div", { className: "grid grid-cols-3 gap-3 text-sm max-sm:grid-cols-1", children: [_jsxs("label", { className: "space-y-1", children: [_jsx("span", { className: "text-xs uppercase text-slate-400", children: "Scheduled for" }), _jsx("input", { type: "date", className: "w-full rounded-lg bg-slate-900 px-3 py-2", value: draft.scheduledFor, onChange: (event) => setDraft((prev) => ({ ...prev, scheduledFor: event.target.value })), required: true })] }), _jsxs("label", { className: "space-y-1", children: [_jsx("span", { className: "text-xs uppercase text-slate-400", children: "Starts at" }), _jsx("input", { type: "time", className: "w-full rounded-lg bg-slate-900 px-3 py-2", value: draft.startTime, onChange: (event) => setDraft((prev) => ({ ...prev, startTime: event.target.value })), required: true })] }), _jsxs("label", { className: "space-y-1", children: [_jsx("span", { className: "text-xs uppercase text-slate-400", children: "Deadline (optional)" }), _jsx("input", { type: "time", className: "w-full rounded-lg bg-slate-900 px-3 py-2", value: draft.deadlineTime, onChange: (event) => setDraft((prev) => ({ ...prev, deadlineTime: event.target.value })) })] })] }), formError && _jsx("p", { className: "text-sm text-rose-300", children: formError }), infoMessage && _jsx("p", { className: "text-sm text-amber-300", children: infoMessage }), _jsxs("p", { className: "text-xs text-slate-400", children: ["Reminders fire ", preferences.reminderLeadMinutes, " minutes before start when notifications are enabled."] }), _jsx("div", { className: "flex justify-end", children: _jsx("button", { type: "submit", className: "rounded-lg bg-[color:var(--accent-600)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[color:var(--accent-500)]", children: "Add task" }) })] })] }), byDate.length === 0 ? (_jsx("p", { className: "rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-400", children: "No tasks yet. Start by planning your day above." })) : (_jsx("div", { className: "space-y-4", children: byDate.map(([date, items]) => (_jsxs("section", { className: "space-y-3", children: [_jsxs("header", { className: "flex items-center justify-between text-sm text-slate-400", children: [_jsx("span", { className: "font-semibold text-slate-200", children: format(parseISO(date), 'EEEE, MMM d') }), _jsxs("span", { children: [items.length, " tasks"] })] }), _jsx("ul", { className: "space-y-2", children: items.map((task) => {
                                const isEditing = editingTaskId === task.id && editDraft;
                                if (isEditing && editDraft) {
                                    return (_jsx("li", { className: "space-y-2 rounded-2xl bg-slate-800/70 p-4", children: _jsxs("form", { className: "space-y-2 text-sm", onSubmit: submitEdit, children: [_jsx("input", { className: "w-full rounded-lg bg-slate-900 px-3 py-2", value: editDraft.title, onChange: (event) => setEditDraft((prev) => prev && { ...prev, title: event.target.value }) }), _jsx("textarea", { className: "w-full rounded-lg bg-slate-900 px-3 py-2", value: editDraft.description, onChange: (event) => setEditDraft((prev) => prev && { ...prev, description: event.target.value }), rows: 3 }), _jsxs("div", { className: "grid grid-cols-3 gap-3 max-sm:grid-cols-1", children: [_jsx("input", { type: "date", className: "rounded-lg bg-slate-900 px-3 py-2", value: editDraft.scheduledFor, onChange: (event) => setEditDraft((prev) => prev && { ...prev, scheduledFor: event.target.value }) }), _jsx("input", { type: "time", className: "rounded-lg bg-slate-900 px-3 py-2", value: editDraft.startTime, onChange: (event) => setEditDraft((prev) => prev && { ...prev, startTime: event.target.value }) }), _jsx("input", { type: "time", className: "rounded-lg bg-slate-900 px-3 py-2", value: editDraft.deadlineTime, onChange: (event) => setEditDraft((prev) => prev && { ...prev, deadlineTime: event.target.value }) })] }), editError && _jsx("p", { className: "text-sm text-rose-300", children: editError }), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx("button", { type: "button", className: "rounded-lg px-3 py-2 text-slate-300", onClick: () => {
                                                                setEditingTaskId(null);
                                                                setEditDraft(null);
                                                            }, children: "Cancel" }), _jsx("button", { type: "submit", className: "rounded-lg bg-[color:var(--accent-600)] px-4 py-2 font-semibold text-white transition-colors hover:bg-[color:var(--accent-500)]", children: "Save" })] })] }) }, task.id));
                                }
                                return (_jsx("li", { className: "rounded-2xl bg-slate-800/70 p-4", children: _jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { className: "space-y-1", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("h3", { className: "font-medium text-slate-100", children: task.title }), _jsx("span", { className: "rounded-full bg-slate-700 px-2 py-0.5 text-[11px] uppercase text-slate-300", children: task.status.replace('_', ' ') })] }), task.description && _jsx("p", { className: "text-sm text-slate-300", children: task.description }), _jsxs("p", { className: "text-xs text-slate-400", children: [timeLabel(task.startAt) ? `Starts ${timeLabel(task.startAt)}` : 'Start time not set', task.deadlineAt ? ` • Deadline ${timeLabel(task.deadlineAt)}` : ''] })] }), _jsxs("div", { className: "flex flex-col gap-1 text-xs", children: [_jsx("button", { className: "rounded-lg bg-slate-700 px-3 py-1 text-slate-200", onClick: () => startEdit(task.id), children: "Edit" }), _jsx("button", { className: "rounded-lg bg-slate-700 px-3 py-1 text-rose-300", onClick: () => actions.deleteTask(task.id), children: "Delete" })] })] }) }, task.id));
                            }) })] }, date))) }))] }));
}
