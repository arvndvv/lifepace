import { addWeeks, differenceInCalendarWeeks, parseISO, startOfWeek } from 'date-fns';
import { isDateWithin } from './date';
const WEEK_OPTIONS = { weekStartsOn: 1 };
export function getWeekIdForDate(dateISO, dateOfBirth) {
    const dobStart = startOfWeek(parseISO(dateOfBirth), WEEK_OPTIONS);
    const dateStart = startOfWeek(parseISO(dateISO), WEEK_OPTIONS);
    const diff = Math.max(0, differenceInCalendarWeeks(dateStart, dobStart, WEEK_OPTIONS));
    return `${dateOfBirth}-week-${diff}`;
}
export function getWeekStartDate(weekId, dateOfBirth) {
    const match = weekId.match(/-week-(\d+)$/);
    const index = match ? Number.parseInt(match[1], 10) : 0;
    const base = startOfWeek(parseISO(dateOfBirth), WEEK_OPTIONS);
    return addWeeks(base, Number.isNaN(index) ? 0 : index);
}
export function computeDaySummaries(tasks, preferences, profile) {
    const byDate = new Map();
    tasks.forEach((task) => {
        const date = task.scheduledFor;
        if (!date) {
            return;
        }
        const bucket = byDate.get(date) ?? { total: 0, completed: 0 };
        bucket.total += 1;
        if (task.status === 'completed') {
            bucket.completed += 1;
        }
        byDate.set(date, bucket);
    });
    const threshold = Math.min(Math.max(preferences.dayFulfillmentThreshold ?? 40, 0), 100);
    const summaries = {};
    byDate.forEach((bucket, date) => {
        const completionRate = bucket.total === 0 ? 0 : bucket.completed / bucket.total;
        const fulfilled = bucket.total > 0 && completionRate * 100 >= threshold;
        summaries[date] = {
            date,
            completionRate,
            totalTasks: bucket.total,
            completedTasks: bucket.completed,
            weekId: getWeekIdForDate(date, profile.dateOfBirth),
            fulfilled
        };
    });
    return summaries;
}
export function deriveAutoWeekWins(daySummaries, weekTarget) {
    const counts = new Map();
    Object.values(daySummaries).forEach((summary) => {
        if (!summary.fulfilled) {
            return;
        }
        counts.set(summary.weekId, (counts.get(summary.weekId) ?? 0) + 1);
    });
    const target = Math.min(Math.max(weekTarget, 1), 7);
    const wins = new Set();
    counts.forEach((value, weekId) => {
        if (value >= target) {
            wins.add(weekId);
        }
    });
    return wins;
}
export function filterDaySummariesByRange(daySummaries, range) {
    const filtered = {};
    Object.entries(daySummaries).forEach(([date, summary]) => {
        if (isDateWithin(date, { start: range.start, end: range.end, label: 'custom' })) {
            filtered[date] = summary;
        }
    });
    return filtered;
}
