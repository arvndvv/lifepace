import { FormEvent, useEffect, useState } from 'react';
import type { Preferences } from '../../types';
import { formatMinutes } from '../../utils/tasks';
import { Portal } from '../Portal';
import type { TaskDraftForm } from '../../utils/taskPlanner';
import { MarkdownContent, MarkdownPlaceholder } from '../MarkdownContent';

interface TaskPlannerModalProps {
  mode: 'create' | 'edit';
  open: boolean;
  draft: TaskDraftForm;
  allocation: { assigned: number; remaining: number };
  preferences: Preferences;
  availableTags: string[];
  error?: string | null;
  onClose: () => void;
  onChange: (updates: Partial<TaskDraftForm>) => void;
  onSubmit: () => void;
}

interface TaskScheduleFieldsProps {
  draft: TaskDraftForm;
  allocation: { assigned: number; remaining: number };
  onChange: (updates: Partial<TaskDraftForm>) => void;
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
}

function TaskScheduleFields({ draft, allocation, onChange }: TaskScheduleFieldsProps) {
  const switchMode = (mode: TaskDraftForm['mode']) => {
    if (mode === draft.mode) {
      return;
    }
    if (mode === 'duration') {
      onChange({ mode, startTime: '', deadlineTime: '' });
      return;
    }
    onChange({ mode, durationHours: 1, durationMinutes: 0 });
  };

  const handleDurationChange = (field: 'durationHours' | 'durationMinutes', raw: string) => {
    const parsed = Number.parseInt(raw, 10);
    const nextValue = field === 'durationHours' ? clamp(parsed, 0, 24) : clamp(parsed, 0, 59);
    onChange({ [field]: nextValue });
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2 text-xs font-medium text-slate-300">
        <button
          type="button"
          className={`rounded-full px-3 py-1 transition-colors ${
            draft.mode === 'time' ? 'bg-[color:var(--accent-600)] text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
          onClick={() => switchMode('time')}
        >
          Schedule by time
        </button>
        <button
          type="button"
          className={`rounded-full px-3 py-1 transition-colors ${
            draft.mode === 'duration'
              ? 'bg-[color:var(--accent-600)] text-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
          onClick={() => switchMode('duration')}
        >
          Assign duration
        </button>
      </div>

      <label className="space-y-1 text-sm">
        <span className="text-xs uppercase text-slate-400">Scheduled for</span>
        <input
          type="date"
          className="w-full rounded-lg bg-slate-900 px-3 py-2"
          value={draft.scheduledFor}
          onChange={(event) => onChange({ scheduledFor: event.target.value })}
          required
        />
      </label>

      {draft.mode === 'time' ? (
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <label className="space-y-1 text-sm">
            <span className="text-xs uppercase text-slate-400">Starts at (optional)</span>
            <input
              type="time"
              className="w-full rounded-lg bg-slate-900 px-3 py-2"
              value={draft.startTime}
              onChange={(event) => onChange({ startTime: event.target.value })}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs uppercase text-slate-400">Deadline (optional)</span>
            <input
              type="time"
              className="w-full rounded-lg bg-slate-900 px-3 py-2"
              value={draft.deadlineTime}
              onChange={(event) => onChange({ deadlineTime: event.target.value })}
            />
          </label>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <label className="space-y-1 text-sm">
            <span className="text-xs uppercase text-slate-400">Hours</span>
            <input
              type="number"
              min={0}
              max={24}
              className="w-full rounded-lg bg-slate-900 px-3 py-2"
              value={draft.durationHours}
              onChange={(event) => handleDurationChange('durationHours', event.target.value)}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs uppercase text-slate-400">Minutes</span>
            <input
              type="number"
              min={0}
              max={59}
              className="w-full rounded-lg bg-slate-900 px-3 py-2"
              value={draft.durationMinutes}
              onChange={(event) => handleDurationChange('durationMinutes', event.target.value)}
            />
          </label>
        </div>
      )}

      <p className="text-xs text-slate-500">
        Active workload today: {formatMinutes(allocation.assigned)} • Time left: {formatMinutes(allocation.remaining)}
      </p>
    </div>
  );
}

export function TaskPlannerModal({
  mode,
  open,
  draft,
  allocation,
  preferences,
  availableTags,
  error,
  onClose,
  onChange,
  onSubmit
}: TaskPlannerModalProps) {
  const [descriptionTab, setDescriptionTab] = useState<'write' | 'preview'>('write');
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setDescriptionTab('write');
      setTagDropdownOpen(false);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  const toggleTag = (tag: string) => {
    const exists = draft.tags.includes(tag);
    const next = exists ? draft.tags.filter((item) => item !== tag) : [...draft.tags, tag];
    onChange({ tags: next });
  };

  const clearTags = () => onChange({ tags: [] });

  return (
    <Portal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-3 py-6 backdrop-blur"
        onClick={onClose}
      >
        <div
          className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-slate-900/95 p-6 shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-100">{mode === 'create' ? 'Plan a task' : 'Edit task'}</h2>
            <button
              type="button"
              className="rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-300 hover:bg-slate-700"
              onClick={onClose}
            >
              Close
            </button>
          </div>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <input
              className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-100"
              placeholder="What will you do?"
              value={draft.title}
              onChange={(event) => onChange({ title: event.target.value })}
              required
            />
            <div>
              <div className="mb-2 inline-flex gap-2 rounded-full bg-slate-800/80 p-1 text-xs text-slate-400">
                <button
                  type="button"
                  className={`rounded-full px-3 py-1 transition-colors ${
                    descriptionTab === 'write'
                      ? 'bg-[color:var(--accent-600)] text-white'
                      : 'hover:text-white'
                  }`}
                  onClick={() => setDescriptionTab('write')}
                >
                  Write
                </button>
                <button
                  type="button"
                  className={`rounded-full px-3 py-1 transition-colors ${
                    descriptionTab === 'preview'
                      ? 'bg-[color:var(--accent-600)] text-white'
                      : 'hover:text-white'
                  }`}
                  onClick={() => setDescriptionTab('preview')}
                >
                  Preview
                </button>
              </div>
              {descriptionTab === 'write' ? (
                <textarea
                  className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-100"
                  placeholder="Add an optional note (Markdown supported)"
                  value={draft.description}
                  onChange={(event) => onChange({ description: event.target.value })}
                  rows={5}
                />
              ) : draft.description ? (
                <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2">
                  <MarkdownContent content={draft.description} />
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-800 px-3 py-6 text-center">
                  <MarkdownPlaceholder message="Nothing to preview yet." />
                </div>
              )}
            </div>

            <div className="space-y-1 text-sm">
              <span className="text-xs uppercase text-slate-400">Tags</span>
              <div className="space-y-2">
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-2 text-xs text-slate-200 hover:border-[color:var(--accent-500)]"
                  onClick={() => setTagDropdownOpen((prev) => !prev)}
                >
                  <span>{draft.tags.length > 0 ? 'Edit tags' : 'Select tags'}</span>
                  <span className="text-[10px] uppercase tracking-wide text-slate-500">
                    {draft.tags.length} selected
                  </span>
                </button>
                {draft.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {draft.tags.map((tag) => (
                      <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-200">
                        {tag}
                        <button
                          type="button"
                          className="text-slate-400 hover:text-rose-300"
                          onClick={() => toggleTag(tag)}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <button
                      type="button"
                      className="text-[11px] text-slate-400 hover:text-rose-300"
                      onClick={clearTags}
                    >
                      Clear
                    </button>
                  </div>
                )}
                {tagDropdownOpen && (
                  <div className="relative">
                    <div className="absolute z-20 mt-2 w-full max-h-60 overflow-auto rounded-xl border border-slate-700 bg-slate-900/95 p-3 shadow-xl">
                      {availableTags.length === 0 ? (
                        <p className="text-xs text-slate-500">No tags yet. Add tags from Settings.</p>
                      ) : (
                        <div className="space-y-2 text-xs text-slate-200 pr-1">
                          {availableTags.map((tag) => {
                            const checked = draft.tags.includes(tag);
                            return (
                              <label key={tag} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 hover:bg-slate-800/60">
                                <span>{tag}</span>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleTag(tag)}
                                  className="h-4 w-4 rounded border-slate-600 bg-slate-900"
                                />
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <TaskScheduleFields draft={draft} allocation={allocation} onChange={onChange} />

            <label className="flex items-start gap-2 rounded-lg bg-slate-800/60 px-3 py-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={draft.progressive}
                onChange={(event) => onChange({ progressive: event.target.checked })}
                className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-900"
              />
              <span>
                Counts toward daily progress{' '}
                <span className="text-slate-500">(need at least {preferences.progressiveTasksPerDay} per day)</span>
              </span>
            </label>

            {error && <p className="text-sm text-rose-300">{error}</p>}

            <p className="text-xs text-slate-400">
              Reminders fire {preferences.reminderLeadMinutes} minutes before start when notifications are enabled.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg px-3 py-2 text-slate-300"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-[color:var(--accent-600)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[color:var(--accent-500)]"
              >
                {mode === 'create' ? 'Add task' : 'Save changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  );
}
