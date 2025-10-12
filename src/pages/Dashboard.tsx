import { format, parseISO } from 'date-fns';
import { useMemo } from 'react';
import { useAppData } from '../context/AppDataContext';
import type { TaskStatus } from '../types';
import { getDayProgress, getTodayISO } from '../utils/date';
import { formatMinutes, getTotalAssignedMinutesForDate, MINUTES_PER_DAY } from '../utils/tasks';

export default function DashboardPage() {
  const {
    state: { profile, tasks },
    actions
  } = useAppData();

  const dayProgress = profile
    ? getDayProgress(profile.dayStartHour, profile.dayEndHour)
    : { totalMinutes: 0, minutesElapsed: 0, minutesRemaining: 0, percentElapsed: 0 };

  const today = getTodayISO();

  const todayTasks = useMemo(
    () =>
      tasks
        .filter((task) => task.scheduledFor === today)
        .sort((a, b) => {
          const aStart = a.startAt ?? '';
          const bStart = b.startAt ?? '';
          return aStart.localeCompare(bStart);
        }),
    [tasks, today]
  );

  const todayTaskStats = useMemo(() => {
    const completed = todayTasks.filter((task) => task.status === 'completed').length;
    const inProgress = todayTasks.filter((task) => task.status === 'in_progress').length;
    const progressive = todayTasks.filter((task) => task.progressive ?? true).length;
    const total = todayTasks.length;
    const completedPercent = total === 0 ? 0 : Math.min(100, (completed / total) * 100);
    const inProgressPercent = total === 0 ? 0 : Math.min(100, (inProgress / total) * 100);
    const progressivePercent = total === 0 ? 0 : Math.min(100, (progressive / total) * 100);
    return { completed, inProgress, progressive, total, completedPercent, inProgressPercent, progressivePercent };
  }, [todayTasks]);

  const assignedMinutes = useMemo(
    () => getTotalAssignedMinutesForDate(tasks, today),
    [tasks, today]
  );
  const taskTimeLeftMinutes = Math.max(0, dayProgress.minutesRemaining - assignedMinutes);
  const overCapacity = assignedMinutes > dayProgress.minutesRemaining;

  if (!profile) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Let&apos;s set up your profile</h2>
        <p className="text-sm text-slate-400">Complete onboarding to start tracking your time.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-slate-800/60 p-4 shadow-lg">
        <header className="mb-3 flex items-center justify-between text-sm text-slate-300">
          <span>Today</span>
          <span>
            {format(new Date(), 'EEEE, MMM d')}
          </span>
        </header>
        <div className="space-y-3">
          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-700">
            <div
              className="h-3 rounded-full bg-[color:var(--accent-500)] transition-all"
              style={{ width: `${dayProgress.percentElapsed}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <div>
              <p className="font-semibold text-slate-200">{Math.round(dayProgress.percentElapsed)}% done</p>
              <p>{Math.round(dayProgress.minutesRemaining / 60)} hours left</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-slate-200">{Math.round(dayProgress.minutesElapsed / 60)} hours spent</p>
              <p>Total {(dayProgress.totalMinutes / 60).toFixed(1)} hours</p>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-slate-900/60 px-3 py-2 text-xs text-slate-300">
            <span>Tasks assigned: {formatMinutes(assignedMinutes)}</span>
            <span>Time left today: {formatMinutes(taskTimeLeftMinutes)}</span>
          </div>
          {assignedMinutes > MINUTES_PER_DAY && (
            <p className="text-xs text-amber-300">
              You have planned more than 24 hours today. Consider trimming tasks.
            </p>
          )}
          {overCapacity && (
            <p className="text-xs text-rose-300">
              Planned work exceeds your remaining day — some tasks may need to move.
            </p>
          )}
          <div className="space-y-2 text-xs text-slate-400">
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span>Completed</span>
                <span className="font-semibold text-slate-200">
                  {todayTaskStats.completed}/{todayTaskStats.total}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-700">
                <div
                  className="h-2 rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${todayTaskStats.completedPercent}%` }}
                />
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span>In progress</span>
                <span className="font-semibold text-slate-200">
                  {todayTaskStats.inProgress}/{todayTaskStats.total}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-700">
                <div
                  className="h-2 rounded-full bg-sky-500 transition-all"
                  style={{ width: `${todayTaskStats.inProgressPercent}%` }}
                />
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span>Progressive</span>
                <span className="font-semibold text-slate-200">
                  {todayTaskStats.progressive}/{todayTaskStats.total}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-700">
                <div
                  className="h-2 rounded-full bg-amber-400 transition-all"
                  style={{ width: `${todayTaskStats.progressivePercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Today&apos;s tasks</h2>
          <span className="text-xs text-slate-400">{todayTasks.length} scheduled</span>
        </div>
        <ul className="space-y-2">
          {todayTasks.length === 0 && (
            <li className="rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">
              Plan something meaningful for today.
            </li>
          )}
          {todayTasks.map((task) => (
            <li key={task.id} className="rounded-2xl bg-slate-800/70 p-4">
              <div className="space-y-2">
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
                  {task.description && <p className="text-sm text-slate-300">{task.description}</p>}
                  <p className="text-xs text-slate-400">
                    {task.startAt ? `Starts ${format(parseISO(task.startAt), 'p')}` : 'No start time'}
                    {task.deadlineAt ? ` • Deadline ${format(parseISO(task.deadlineAt), 'p')}` : ''}
                    {task.durationMinutes ? ` • Duration ${formatMinutes(task.durationMinutes)}` : ''}
                    {task.reminderAt ? ` • Reminder ${format(parseISO(task.reminderAt), 'p')}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {(['planned', 'in_progress', 'completed', 'skipped'] as TaskStatus[]).map((status) => (
                    <button
                      key={status}
                      type="button"
                      className={`rounded-full px-3 py-1 capitalize transition-colors ${
                        task.status === status
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
          ))}
        </ul>
      </section>
    </div>
  );
}
