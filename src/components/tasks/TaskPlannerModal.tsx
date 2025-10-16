import { FormEvent, useEffect, useRef, useState } from 'react';
import type { Preferences } from '../../types';
import { formatMinutes } from '../../utils/tasks';
import { Portal } from '../Portal';
import type { TaskDraftForm } from '../../utils/taskPlanner';
import { MarkdownContent, MarkdownPlaceholder } from '../MarkdownContent';
import { DialogCloseButton } from '../DialogCloseButton';

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
    <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <span className="text-[11px] uppercase tracking-wide text-slate-400">Scheduling mode</span>
      <div className="flex gap-2 text-xs font-medium text-slate-300">
        <button
          type="button"
          className={`rounded-full px-3 py-1 transition-colors ${
            draft.mode === 'time'
              ? 'bg-[color:var(--accent-600)] text-white shadow-[0_16px_32px_-20px_var(--accent-shadow-strong)]'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
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

      <label className="block space-y-1 text-sm">
        <span className="text-xs uppercase text-slate-400">Scheduled for</span>
        <input
          type="date"
          className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-2 text-sm text-slate-100 focus:border-[color:var(--accent-500)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-500)]/40"
          value={draft.scheduledFor}
          onChange={(event) => onChange({ scheduledFor: event.target.value })}
          required
        />
      </label>

      {draft.mode === 'time' ? (
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1 text-sm">
            <span className="text-xs uppercase text-slate-400">Starts at (optional)</span>
            <input
              type="time"
              className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-2 text-sm text-slate-100 focus:border-[color:var(--accent-500)] focus:outline-none focus:ring-1 focus:ring-[color:var(--accent-500)]/30"
              value={draft.startTime}
              onChange={(event) => onChange({ startTime: event.target.value })}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs uppercase text-slate-400">Deadline (optional)</span>
            <input
              type="time"
              className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-2 text-sm text-slate-100 focus:border-[color:var(--accent-500)] focus:outline-none focus:ring-1 focus:ring-[color:var(--accent-500)]/30"
              value={draft.deadlineTime}
              onChange={(event) => onChange({ deadlineTime: event.target.value })}
            />
          </label>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1 text-sm">
            <span className="text-xs uppercase text-slate-400">Hours</span>
            <input
              type="number"
              min={0}
              max={24}
              className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-2 text-sm text-slate-100 focus:border-[color:var(--accent-500)] focus:outline-none focus:ring-1 focus:ring-[color:var(--accent-500)]/30"
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
              className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-2 text-sm text-slate-100 focus:border-[color:var(--accent-500)] focus:outline-none focus:ring-1 focus:ring-[color:var(--accent-500)]/30"
              value={draft.durationMinutes}
              onChange={(event) => handleDurationChange('durationMinutes', event.target.value)}
            />
          </label>
        </div>
      )}

      <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-[11px] text-slate-300">
        <span className="font-medium text-slate-200">Active load:</span> {formatMinutes(allocation.assigned)}
        <span className="mx-2 text-slate-600">|</span>
        <span className="font-medium text-slate-200">Time left:</span> {formatMinutes(allocation.remaining)}
      </div>
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
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      setDescriptionTab('write');
      setTagDropdownOpen(false);
    }
  }, [open]);

  useEffect(() => {
    if (!tagDropdownOpen) {
      return;
    }
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setTagDropdownOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setTagDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [tagDropdownOpen]);

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
        role="dialog"
        aria-modal="true"
      >
        <div
          className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-slate-900/95 p-6 shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-100">{mode === 'create' ? 'Plan a task' : 'Edit task'}</h2>
            <DialogCloseButton onClick={onClose} />
          </div>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-1">
              <span className="text-xs uppercase text-slate-400">Title</span>
              <input
                className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-2.5 text-sm text-slate-100 focus:border-[color:var(--accent-500)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-500)]/40"
                placeholder="What will you do?"
                value={draft.title}
                onChange={(event) => onChange({ title: event.target.value })}
                required
              />
            </div>
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
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 focus:border-[color:var(--accent-500)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-500)]/40"
                  placeholder="Add an optional note (Markdown supported)"
                  value={draft.description}
                  onChange={(event) => onChange({ description: event.target.value })}
                  rows={6}
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

            <div className="space-y-2 text-sm">
              <span className="text-xs uppercase text-slate-400">Tags</span>
              <div ref={dropdownRef} className="relative flex flex-wrap items-center gap-2">
                {draft.tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-3 py-1 text-[11px] text-slate-200">
                    {tag}
                    <button
                      type="button"
                      aria-label={`Remove ${tag}`}
                      className="text-slate-400 transition-colors hover:text-rose-300"
                      onClick={() => toggleTag(tag)}
                    >
                      ×
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    tagDropdownOpen
                      ? 'border-[color:var(--accent-500)] bg-[color:var(--accent-600)]/10 text-slate-100'
                      : 'border-slate-700 bg-slate-900/60 text-slate-200 hover:border-[color:var(--accent-500)]/70'
                  }`}
                  onClick={() => setTagDropdownOpen((prev) => !prev)}
                >
                  {draft.tags.length > 0 ? 'Edit tags' : 'Select tags'}
                  <span className="text-[10px] uppercase tracking-wide text-slate-500">
                    {draft.tags.length} selected
                  </span>
                </button>
                {draft.tags.length > 0 && (
                  <button
                    type="button"
                    className="text-[11px] text-slate-400 underline-offset-2 transition-colors hover:text-rose-300 hover:underline"
                    onClick={clearTags}
                  >
                    Clear
                  </button>
                )}
                {tagDropdownOpen && (
                  <div className="absolute right-0 top-full z-20 mt-2 w-full min-w-[220px] max-w-xs overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/95 shadow-xl">
                    {availableTags.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-slate-500">No tags yet. Add tags from Settings.</p>
                    ) : (
                      <ul className="max-h-60 overflow-auto py-2 text-xs text-slate-200">
                        {availableTags.map((tag) => {
                          const active = draft.tags.includes(tag);
                          return (
                            <li key={tag}>
                              <button
                                type="button"
                                onClick={() => toggleTag(tag)}
                                className={`flex w-full items-center justify-between px-3 py-2 text-left transition-colors ${
                                  active ? 'bg-[color:var(--accent-600)]/20 text-slate-50' : 'hover:bg-slate-800/80'
                                }`}
                              >
                                <span>{tag}</span>
                                <span
                                  className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                                    active
                                      ? 'border-[color:var(--accent-500)] bg-[color:var(--accent-600)]/30 text-[color:var(--accent-200)]'
                                      : 'border-slate-700 text-transparent'
                                  }`}
                                  aria-hidden="true"
                                >
                                  ✓
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>

            <TaskScheduleFields draft={draft} allocation={allocation} onChange={onChange} />

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-xs text-slate-300">
              <div className="flex-1">
                <p className="font-semibold text-slate-100">Counts toward daily progress</p>
                <p className="text-[11px] text-slate-500">Need at least {preferences.progressiveTasksPerDay} per day</p>
              </div>
              <button
                type="button"
                onClick={() => onChange({ progressive: !draft.progressive })}
                className={`flex h-6 w-12 items-center rounded-full border px-1 transition-colors ${
                  draft.progressive
                    ? 'border-[color:var(--accent-500)] bg-[color:var(--accent-600)]/40'
                    : 'border-slate-700 bg-slate-800'
                }`}
                aria-pressed={draft.progressive}
                aria-label="Toggle counts toward progress"
              >
                <span
                  className={`h-4 w-4 rounded-full bg-white transition-transform ${
                    draft.progressive ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {error && <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p>}

            <p className="rounded-2xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs text-slate-400">
              Reminders fire {preferences.reminderLeadMinutes} minutes before start when notifications are enabled.
            </p>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <button
                type="button"
                className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-slate-500"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-full bg-[color:var(--accent-600)] px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-[color:var(--accent-500)] shadow-[0_18px_32px_-24px_var(--accent-shadow-strong)]"
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
