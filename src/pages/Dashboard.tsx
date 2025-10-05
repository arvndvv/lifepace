import { format, parseISO } from 'date-fns';
import { useMemo } from 'react';
import { useAppData } from '../context/AppDataContext';
import { getDayProgress, getTodayISO } from '../utils/date';

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
            <li
              key={task.id}
              className="flex items-start justify-between gap-3 rounded-2xl bg-slate-800/70 p-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-slate-100">{task.title}</h3>
                  <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[11px] uppercase text-slate-300">
                    {task.status.replace('_', ' ')}
                  </span>
                </div>
                {task.description && <p className="text-sm text-slate-300">{task.description}</p>}
                <p className="text-xs text-slate-400">
                  {task.startAt ? `Starts ${format(parseISO(task.startAt), 'p')}` : 'Start time not set'}
                  {task.deadlineAt ? ` • Deadline ${format(parseISO(task.deadlineAt), 'p')}` : ''}
                  {task.reminderAt ? ` • Reminder ${format(parseISO(task.reminderAt), 'p')}` : ''}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 text-xs">
                {['planned', 'in_progress', 'completed', 'skipped'].map((status) => (
                  <button
                    key={status}
                    className={`rounded-full px-3 py-1 capitalize transition-colors ${
                      task.status === status
                        ? 'bg-[color:var(--accent-600)] text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                    onClick={() => actions.setTaskStatus(task.id, status as typeof task.status)}
                  >
                    {status.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
