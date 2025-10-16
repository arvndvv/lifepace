import type { Task } from '../../types';
import { formatMinutes, getTaskDurationMinutes } from '../../utils/tasks';
import { timeLabel } from '../../utils/taskPlanner';
import { MarkdownContent } from '../MarkdownContent';
import { Portal } from '../Portal';
import { DialogCloseButton } from '../DialogCloseButton';

interface TaskDetailsDialogProps {
  task: Task | null;
  open: boolean;
  onClose: () => void;
  onEdit?: (task: Task) => void;
}

export function TaskDetailsDialog({ task, open, onClose, onEdit }: TaskDetailsDialogProps) {
  if (!open || !task) {
    return null;
  }

  const duration = getTaskDurationMinutes(task);
  const info: string[] = [];
  const start = timeLabel(task.startAt);
  if (start) {
    info.push(`Starts ${start}`);
  }
  const deadline = timeLabel(task.deadlineAt);
  if (deadline) {
    info.push(`Deadline ${deadline}`);
  }
  if (duration) {
    info.push(`Duration ${formatMinutes(duration)}`);
  }
  const reminder = timeLabel(task.reminderAt);
  if (reminder) {
    info.push(`Reminder ${reminder}`);
  }

  return (
    <Portal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-3 py-6 backdrop-blur"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
      >
        <div
          className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-800 bg-slate-900/95 p-6 shadow-[0_40px_80px_-30px_rgba(15,23,42,0.85)]"
          onClick={(event) => event.stopPropagation()}
        >
          <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-slate-100">{task.title}</h2>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-slate-800 px-2.5 py-1 uppercase tracking-wide text-slate-300">
                  {task.status.replace('_', ' ')}
                </span>
                {task.progressive && (
                  <span className="rounded-full bg-emerald-600/20 px-2.5 py-1 uppercase tracking-wide text-emerald-200">
                    Progressive
                  </span>
                )}
                {duration > 0 && (
                  <span className="rounded-full bg-slate-800 px-2.5 py-1 text-slate-200">
                    {formatMinutes(duration)} planned
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {onEdit && (
                <button
                  type="button"
                  className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"
                  onClick={() => onEdit(task)}
                >
                  Edit task
                </button>
              )}
              <DialogCloseButton onClick={onClose} />
            </div>
          </header>

          <section className="space-y-4 text-sm text-slate-200">
            <div className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-xs text-slate-300 sm:grid-cols-2">
              <p>
                <span className="font-semibold text-slate-100">Scheduled:</span> {task.scheduledFor}
              </p>
              {info.map((piece) => (
                <p key={piece}>{piece}</p>
              ))}
            </div>

            {task.tags.length > 0 && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-xs text-slate-300">
                <p className="mb-2 text-[11px] uppercase tracking-wide text-slate-500">Tags</p>
                <div className="flex flex-wrap gap-2">
                  {task.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-slate-800 px-3 py-1">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <p className="mb-2 text-[11px] uppercase tracking-wide text-slate-500">Description</p>
              {task.description ? (
                <MarkdownContent content={task.description} className="space-y-3" />
              ) : (
                <p className="text-xs text-slate-500">No description provided.</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </Portal>
  );
}
