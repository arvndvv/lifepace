import type { Task } from '../../types';
import { formatMinutes, getTaskDurationMinutes } from '../../utils/tasks';
import { timeLabel } from '../../utils/taskPlanner';
import { MarkdownContent } from '../MarkdownContent';
import { Portal } from '../Portal';

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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur" onClick={onClose}>
        <div className="w-full max-w-lg rounded-2xl bg-slate-900 p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-100">Task details</h2>
            <div className="flex gap-2">
              {onEdit && (
                <button
                  type="button"
                  className="rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-200 hover:bg-slate-700"
                  onClick={() => onEdit(task)}
                >
                  Edit
                </button>
              )}
              <button
                type="button"
                className="rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-300 hover:bg-slate-700"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </div>
          <div className="space-y-3 text-sm">
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
            {task.description ? (
              <MarkdownContent content={task.description} className="space-y-3" />
            ) : (
              <p className="text-xs text-slate-500">No description provided.</p>
            )}
            {task.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 text-[11px]">
                {task.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-slate-800 px-2 py-0.5 text-slate-200">
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <p className="text-xs text-slate-400">
              Scheduled for {task.scheduledFor}
              {info.length > 0 ? ` • ${info.join(' • ')}` : ''}
            </p>
          </div>
        </div>
      </div>
    </Portal>
  );
}
