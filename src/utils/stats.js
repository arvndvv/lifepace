import { isDateWithin } from './date';
function calculateCounts(tasks, period) {
    return tasks.reduce((acc, task) => {
        if (!isDateWithin(task.scheduledFor, period)) {
            return acc;
        }
        acc[task.status] += 1;
        return acc;
    }, { planned: 0, in_progress: 0, completed: 0, skipped: 0 });
}
export function buildTaskSummary(tasks, period) {
    const counts = calculateCounts(tasks, period);
    const total = counts.planned + counts.in_progress + counts.completed + counts.skipped;
    const completionRate = total === 0 ? 0 : counts.completed / total;
    const startedRate = total === 0 ? 0 : (counts.in_progress + counts.completed) / total;
    const droppedRate = total === 0 ? 0 : counts.skipped / total;
    return {
        total,
        counts,
        completionRate,
        startedRate,
        droppedRate
    };
}
