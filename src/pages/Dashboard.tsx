import { format, parseISO } from 'date-fns';
import { useMemo, useState } from 'react';
import { useAppData } from '../context/AppDataContext';
import type { Task, TaskStatus } from '../types';
import { getDayProgress, getTodayISO } from '../utils/date';
import {
  formatMinutes,
  getRemainingMinutesForDay,
  getTaskDurationMinutes,
  getTotalAssignedMinutesForDate,
  MINUTES_PER_DAY
} from '../utils/tasks';
import {
  TaskPlannerModal
} from '../components/tasks/TaskPlannerModal';
import { TaskDetailsDialog } from '../components/tasks/TaskDetailsDialog';
import {
  buildReminder,
  canFitDuration,
  createTaskDraft,
  draftFromTask,
  validateSchedule,
  type TaskDraftForm
} from '../utils/taskPlanner';

function formatHoursMinutes(totalMinutes: number): string {
  const minutes = Math.max(0, Math.floor(totalMinutes));
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) {
    return `${remainder}m`;
  }
  if (remainder === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${remainder}m`;
}

export default function DashboardPage() {
  const {
    state: { profile, tasks, preferences, taskTags },
    actions
  } = useAppData();

  const dayProgress = profile
    ? getDayProgress(profile.dayStartHour, profile.dayEndHour)
    : { totalMinutes: 0, minutesElapsed: 0, minutesRemaining: 0, percentElapsed: 0 };

  const today = getTodayISO();
  const defaultStartTime = preferences.defaultReminderTime ?? '';

  const [viewTaskId, setViewTaskId] = useState<string | null>(null);
  const [plannerModal, setPlannerModal] = useState<{ mode: 'edit'; taskId: string } | null>(null);
  const [plannerDraft, setPlannerDraft] = useState<TaskDraftForm>(() => {
    const base = createTaskDraft(defaultStartTime);
    return { ...base, scheduledFor: today };
  });
  const [plannerError, setPlannerError] = useState<string | null>(null);

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

  const viewTask = useMemo(
    () => tasks.find((task) => task.id === viewTaskId) ?? null,
    [tasks, viewTaskId]
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
    () => getTotalAssignedMinutesForDate(tasks, today, undefined, { excludeCompleted: true }),
    [tasks, today]
  );
  const taskTimeLeftMinutes = Math.max(0, dayProgress.minutesRemaining - assignedMinutes);
  const overCapacity = assignedMinutes > dayProgress.minutesRemaining;

  const plannerAllocation = useMemo(() => {
    if (!plannerModal) {
      return { assigned: 0, remaining: MINUTES_PER_DAY };
    }
    const scheduledFor = plannerDraft.scheduledFor || today;
    return getRemainingMinutesForDay(tasks, scheduledFor, plannerModal.taskId, { excludeCompleted: true });
  }, [plannerModal, plannerDraft.scheduledFor, tasks, today]);

  const openEditModal = (task: Task) => {
    setViewTaskId(null);
    setPlannerDraft(draftFromTask(task, defaultStartTime));
    setPlannerModal({ mode: 'edit', taskId: task.id });
    setPlannerError(null);
  };

  const closePlannerModal = () => {
    setPlannerModal(null);
    setPlannerError(null);
    setPlannerDraft(() => {
      const base = createTaskDraft(defaultStartTime);
      return { ...base, scheduledFor: today };
    });
  };

  const handlePlannerSubmit = () => {
    if (!plannerModal) {
      return;
    }
    setPlannerError(null);

    const trimmedTitle = plannerDraft.title.trim();
    if (!trimmedTitle) {
      setPlannerError('Give the task a name.');
      return;
    }

    const scheduledFor = plannerDraft.scheduledFor;
    const validation = validateSchedule(tasks, scheduledFor, plannerDraft, plannerModal.taskId);
    if ('error' in validation) {
      setPlannerError(validation.error);
      return;
    }

    if (!canFitDuration(plannerAllocation.remaining, plannerDraft)) {
      setPlannerError('Task duration exceeds your remaining time for that day. Adjust duration or reschedule.');
      return;
    }

    const startAt = validation.startAt;
    const deadlineAt = validation.deadlineAt;
    const reminderAt = buildReminder(startAt, preferences.reminderLeadMinutes);

    actions.updateTask(plannerModal.taskId, {
      title: trimmedTitle,
      description: plannerDraft.description.trim() || undefined,
      scheduledFor,
      startAt,
      deadlineAt,
      reminderAt,
      durationMinutes: validation.durationMinutes,
      progressive: plannerDraft.progressive,
      tags: plannerDraft.tags
    });

    closePlannerModal();
  };

  if (!profile) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Let&apos;s set up your profile</h2>
        <p className="text-sm text-slate-400">Complete onboarding to start tracking your time.</p>
      </div>
    );
  }

  return (
    <>
      <div className='md:hidden mb-5'>
        <h1 className="text-2xl font-semibold text-slate-100">LifePace</h1>
        <p className="text-sm text-slate-400">Design your weeks, honour your life.</p>
      </div>
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
                <p>{formatHoursMinutes(dayProgress.minutesRemaining)} left</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-slate-200">{formatHoursMinutes(dayProgress.minutesElapsed)} spent</p>
                <p>Total {formatHoursMinutes(dayProgress.totalMinutes)}</p>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-900/60 px-3 py-2 text-xs text-slate-300">
              <span>Active workload: {formatMinutes(assignedMinutes)}</span>
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
            {todayTasks.map((task) => {
              const durationMinutes = getTaskDurationMinutes(task);
              return (
                <li
                  key={task.id}
                  className="rounded-2xl bg-slate-800/70 p-4 cursor-pointer"
                  onClick={() => setViewTaskId(task.id)}
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-3">
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
                        {task.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 text-[11px] text-slate-300">
                            {task.tags.map((tag) => (
                              <span key={tag} className="rounded-full bg-slate-700/80 px-2 py-0.5">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                        {task.description && <p className="text-sm text-slate-300">{task.description}</p>}
                        <p className="text-xs text-slate-400">
                          {task.startAt ? `Starts ${format(parseISO(task.startAt), 'p')}` : 'No start time'}
                          {task.deadlineAt ? ` • Deadline ${format(parseISO(task.deadlineAt), 'p')}` : ''}
                          {durationMinutes ? ` • Duration ${formatMinutes(durationMinutes)}` : ''}
                          {task.reminderAt ? ` • Reminder ${format(parseISO(task.reminderAt), 'p')}` : ''}
                        </p>
                      </div>
                      <div className="flex gap-2 text-xs" onClick={(event) => event.stopPropagation()}>
                        <button
                          className="rounded-lg bg-slate-700 px-3 py-1 text-slate-200"
                          onClick={() => openEditModal(task)}
                        >
                          Edit
                        </button>
                        <button
                          className="rounded-lg bg-slate-700 px-3 py-1 text-rose-300"
                          onClick={() => actions.deleteTask(task.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs" onClick={(event) => event.stopPropagation()}>
                      {(['planned', 'in_progress', 'completed', 'skipped'] as TaskStatus[]).map((status) => (
                        <button
                          key={status}
                          type="button"
                          className={`rounded-full px-3 py-1 capitalize transition-colors ${task.status === status
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
              );
            })}
          </ul>
        </section>
        <TaskPlannerModal
          mode={plannerModal?.mode ?? 'edit'}
          open={Boolean(plannerModal)}
          draft={plannerDraft}
          allocation={plannerAllocation}
          preferences={preferences}
          availableTags={taskTags}
          error={plannerError}
          onClose={closePlannerModal}
          onChange={(updates) => setPlannerDraft((prev) => ({ ...prev, ...updates }))}
          onSubmit={handlePlannerSubmit}
        />

        <TaskDetailsDialog
          task={viewTask}
          open={Boolean(viewTask)}
          onClose={() => setViewTaskId(null)}
          onEdit={openEditModal}
        />

      </div>
    </>
  );
}
