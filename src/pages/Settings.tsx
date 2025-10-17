import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import type { AccentTheme, SurfaceTheme } from '../types';
import { useAppData } from '../context/AppDataContext';
import { useNotifications } from '../hooks/useNotifications';
import { createExportPayload, parseImportedPayload } from '../utils/storage';

export default function SettingsPage() {
  const {
    state,
    actions
  } = useAppData();
  const { permission, requestPermission } = useNotifications();

  const profile = state.profile;
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');

  const [form, setForm] = useState(() =>
    profile
      ? {
          name: profile.name,
          dateOfBirth: profile.dateOfBirth,
          lifeExpectancyYears: profile.lifeExpectancyYears,
          dayStartHour: profile.dayStartHour,
          dayEndHour: profile.dayEndHour,
          allowNotifications: profile.allowNotifications
        }
      : null
  );

  const [preferencesForm, setPreferencesForm] = useState<{
    reminderLeadMinutes: number;
    defaultReminderTime: string;
    accentTheme: AccentTheme;
    surfaceTheme: SurfaceTheme;
    progressiveTasksPerDay: number;
    progressiveDaysForWeekWin: number;
    showLifeCalendar: boolean;
  }>(() => ({
    reminderLeadMinutes: state.preferences.reminderLeadMinutes,
    defaultReminderTime: state.preferences.defaultReminderTime ?? '',
    accentTheme: state.preferences.accentTheme ?? 'aurora',
    surfaceTheme: state.preferences.surfaceTheme ?? 'indigo',
    progressiveTasksPerDay: state.preferences.progressiveTasksPerDay ?? 1,
    progressiveDaysForWeekWin: state.preferences.progressiveDaysForWeekWin ?? 3,
    showLifeCalendar: state.preferences.showLifeCalendar ?? true
  }));

  const accentOptions = [
    {
      key: 'aurora' as const,
      label: 'Aurora',
      description: 'Fresh teal energy',
      swatch: 'bg-gradient-to-r from-emerald-300 via-emerald-400 to-cyan-400'
    },
    {
      key: 'forest' as const,
      label: 'Forest',
      description: 'Deep woodland greens',
      swatch: 'bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-700'
    },
    {
      key: 'sunset' as const,
      label: 'Sunset',
      description: 'Warm amber glow',
      swatch: 'bg-gradient-to-r from-amber-300 via-orange-400 to-rose-400'
    },
    {
      key: 'midnight' as const,
      label: 'Midnight',
      description: 'Moody indigo nights',
      swatch: 'bg-gradient-to-r from-slate-400 via-indigo-500 to-slate-600'
    }
  ];

  const surfaceOptions = [
    {
      key: 'indigo' as const,
      label: 'Indigo glow',
      description: 'Electric blues with aurora haze',
      preview: 'linear-gradient(180deg, #030617 0%, #13244f 60%, #040617 100%)'
    },
    {
      key: 'dawn' as const,
      label: 'Dawn ember',
      description: 'Warm sunrise magentas',
      preview: 'linear-gradient(180deg, #260610 0%, #5a1d28 60%, #20040d 100%)'
    },
    {
      key: 'glacier' as const,
      label: 'Glacier drift',
      description: 'Icy teals with crisp glow',
      preview: 'linear-gradient(180deg, #001922 0%, #014152 60%, #00131a 100%)'
    },
    {
      key: 'midnight' as const,
      label: 'Nebula night',
      description: 'Violet cosmic ambience',
      preview: 'linear-gradient(180deg, #050019 0%, #1b1242 60%, #080017 100%)'
    },
    {
      key: 'slate' as const,
      label: 'Storm slate',
      description: 'Moody blue-grey dusk',
      preview: 'linear-gradient(180deg, #07121f 0%, #1d2f3f 60%, #07121f 100%)'
    },
    {
      key: 'charcoal' as const,
      label: 'Noir focus',
      description: 'Minimal graphite night',
      preview: 'linear-gradient(180deg, #040404 0%, #0f1216 55%, #040404 100%)'
    }
  ];

  const handleAccentSelect = (accent: AccentTheme) => {
    if (preferencesForm.accentTheme === accent) {
      return;
    }
    const option = accentOptions.find((item) => item.key === accent);
    setPreferencesForm((prev) => ({ ...prev, accentTheme: accent }));
    actions.setPreferences({ accentTheme: accent });
    setStatusMessage(option ? `Accent theme set to ${option.label}` : 'Accent updated');
    setErrorMessage(null);
  };

  const handleSurfaceSelect = (surface: SurfaceTheme) => {
    if (preferencesForm.surfaceTheme === surface) {
      return;
    }
    const option = surfaceOptions.find((item) => item.key === surface);
    setPreferencesForm((prev) => ({ ...prev, surfaceTheme: surface }));
    actions.setPreferences({ surfaceTheme: surface });
    setStatusMessage(option ? `Surface tone set to ${option.label}` : 'Surface updated');
    setErrorMessage(null);
  };

  const exportPayload = useMemo(() => createExportPayload(state), [state]);

  useEffect(() => {
    setPreferencesForm({
      reminderLeadMinutes: state.preferences.reminderLeadMinutes,
      defaultReminderTime: state.preferences.defaultReminderTime ?? '',
      accentTheme: state.preferences.accentTheme ?? 'aurora',
      surfaceTheme: state.preferences.surfaceTheme ?? 'indigo',
      progressiveTasksPerDay: state.preferences.progressiveTasksPerDay ?? 1,
      progressiveDaysForWeekWin: state.preferences.progressiveDaysForWeekWin ?? 3,
      showLifeCalendar: state.preferences.showLifeCalendar ?? true
    });
  }, [state.preferences]);

  if (!profile || !form) {
    return <p className="text-sm text-slate-400">Complete onboarding to access settings.</p>;
  }

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    actions.updateProfile({
      name: form.name,
      dateOfBirth: form.dateOfBirth,
      lifeExpectancyYears: form.lifeExpectancyYears,
      dayStartHour: form.dayStartHour,
      dayEndHour: form.dayEndHour,
      allowNotifications: form.allowNotifications
    });
    actions.setPreferences({
      reminderLeadMinutes: preferencesForm.reminderLeadMinutes,
      defaultReminderTime: preferencesForm.defaultReminderTime || undefined,
      accentTheme: preferencesForm.accentTheme,
      surfaceTheme: preferencesForm.surfaceTheme,
      progressiveTasksPerDay: preferencesForm.progressiveTasksPerDay,
      progressiveDaysForWeekWin: preferencesForm.progressiveDaysForWeekWin,
      showLifeCalendar: preferencesForm.showLifeCalendar
    });
    setStatusMessage('Preferences updated');
    setErrorMessage(null);
  };

  const toggleNotifications = async (enabled: boolean) => {
    if (enabled && permission !== 'granted') {
      const result = await requestPermission();
      if (result !== 'granted') {
        setErrorMessage('Notifications were blocked by the browser');
        setForm((prev) => prev && { ...prev, allowNotifications: false });
        return;
      }
    }
    setForm((prev) => prev && { ...prev, allowNotifications: enabled });
    actions.updateProfile({ allowNotifications: enabled });
  };

  const handleExport = () => {
    const blob = new Blob([exportPayload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `lifepace-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatusMessage('Export ready. Check your downloads folder.');
    setErrorMessage(null);
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      const text = await file.text();
      const importedState = parseImportedPayload(text);
      actions.importState(importedState);
      setStatusMessage('Data imported successfully');
      setErrorMessage(null);
      setPreferencesForm({
        reminderLeadMinutes: importedState.preferences.reminderLeadMinutes,
        defaultReminderTime: importedState.preferences.defaultReminderTime ?? '',
        accentTheme: importedState.preferences.accentTheme ?? 'aurora',
        surfaceTheme: importedState.preferences.surfaceTheme ?? 'indigo',
        progressiveTasksPerDay: importedState.preferences.progressiveTasksPerDay ?? 1,
        progressiveDaysForWeekWin: importedState.preferences.progressiveDaysForWeekWin ?? 3,
        showLifeCalendar: importedState.preferences.showLifeCalendar ?? true
      });
    } catch (error) {
      console.error(error);
      setErrorMessage('Import failed. Please ensure the file was exported from LifePace.');
    } finally {
      event.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-slate-800/70 p-4">
        <h2 className="text-lg font-semibold">Profile & preferences</h2>
        <form className="mt-4 space-y-3 text-sm" onSubmit={onSubmit}>
          <label className="block space-y-1">
            <span className="text-slate-300">Name</span>
            <input
              className="w-full rounded-lg bg-slate-900 px-3 py-2"
              value={form.name}
              onChange={(event) => setForm((prev) => prev && { ...prev, name: event.target.value })}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-slate-300">Date of birth</span>
            <input
              type="date"
              className="w-full rounded-lg bg-slate-900 px-3 py-2"
              value={form.dateOfBirth}
              onChange={(event) => setForm((prev) => prev && { ...prev, dateOfBirth: event.target.value })}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-slate-300">Day starts</span>
              <input
                type="number"
                min={0}
                max={23}
                className="w-full rounded-lg bg-slate-900 px-3 py-2"
                value={form.dayStartHour}
                onChange={(event) =>
                  setForm((prev) =>
                    prev && { ...prev, dayStartHour: Number.parseInt(event.target.value, 10) || 0 }
                  )
                }
              />
            </label>
            <label className="space-y-1">
              <span className="text-slate-300">Day ends</span>
              <input
                type="number"
                min={1}
                max={24}
                className="w-full rounded-lg bg-slate-900 px-3 py-2"
                value={form.dayEndHour}
                onChange={(event) =>
                  setForm((prev) =>
                    prev && { ...prev, dayEndHour: Number.parseInt(event.target.value, 10) || 24 }
                  )
                }
              />
            </label>
          </div>
          <label className="block space-y-1">
            <span className="text-slate-300">Life expectancy</span>
            <input
              type="number"
              min={40}
              max={120}
              className="w-full rounded-lg bg-slate-900 px-3 py-2"
              value={form.lifeExpectancyYears}
              onChange={(event) =>
                setForm((prev) =>
                  prev && {
                    ...prev,
                    lifeExpectancyYears: Number.parseInt(event.target.value, 10) || prev.lifeExpectancyYears
                  }
                )
              }
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-slate-300">Task Reminder lead (minutes)</span>
              <input
                type="number"
                min={0}
                max={720}
                className="w-full rounded-lg bg-slate-900 px-3 py-2"
                value={preferencesForm.reminderLeadMinutes}
                onChange={(event) =>
                  setPreferencesForm((prev) => ({
                    ...prev,
                    reminderLeadMinutes: Number.parseInt(event.target.value, 10) || 0
                  }))
                }
              />
            </label>
            <label className="space-y-1">
              <span className="text-slate-300">Default reminder time (Task)</span>
              <input
                type="time"
                className="w-full rounded-lg bg-slate-900 px-3 py-2"
                value={preferencesForm.defaultReminderTime}
                onChange={(event) =>
                  setPreferencesForm((prev) => ({ ...prev, defaultReminderTime: event.target.value }))
                }
              />
            </label>
            <label className="space-y-1">
              <span className="text-slate-300">Progressive tasks per day</span>
              <input
                type="number"
                min={0}
                max={24}
                className="w-full rounded-lg bg-slate-900 px-3 py-2"
                value={preferencesForm.progressiveTasksPerDay}
                onChange={(event) =>
                  setPreferencesForm((prev) => ({
                    ...prev,
                    progressiveTasksPerDay: Number.parseInt(event.target.value, 10) || 0
                  }))
                }
              />
            </label>
            <label className="space-y-1">
              <span className="text-slate-300">Progressed days for week win</span>
              <input
                type="number"
                min={0}
                max={7}
                className="w-full rounded-lg bg-slate-900 px-3 py-2"
                value={preferencesForm.progressiveDaysForWeekWin}
                onChange={(event) =>
                  setPreferencesForm((prev) => ({
                    ...prev,
                    progressiveDaysForWeekWin: Number.parseInt(event.target.value, 10) || 0
                  }))
                }
              />
            </label>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-slate-900/60 px-3 py-2">
            <div>
              <p className="text-sm text-slate-200">Reminders</p>
              <p className="text-xs text-slate-400">Push-style notifications when tasks are due</p>
            </div>
            <div className="inline-flex items-center gap-2">
              <span className="text-xs text-slate-500">Off</span>
              <button
                type="button"
                role="switch"
                aria-checked={form.allowNotifications}
                className={`flex h-6 w-12 items-center rounded-full border px-1 transition-colors ${
                  form.allowNotifications
                    ? 'border-[color:var(--accent-500)] bg-[color:var(--accent-600)]/40'
                    : 'border-slate-700 bg-slate-800'
                }`}
                onClick={() => toggleNotifications(!form.allowNotifications)}
              >
                <span
                  className={`h-4 w-4 rounded-full bg-white transition-transform ${
                    form.allowNotifications ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className="text-xs text-slate-500">On</span>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-slate-900/60 px-3 py-2">
            <div>
              <p className="text-sm text-slate-200">Weeks-of-life timeline</p>
              <p className="text-xs text-slate-400">Toggle the timeline in the Life view.</p>
            </div>
            <div className="inline-flex items-center gap-2">
              <span className="text-xs text-slate-500">Off</span>
              <button
                type="button"
                role="switch"
                aria-checked={preferencesForm.showLifeCalendar}
                className={`flex h-6 w-12 items-center rounded-full border px-1 transition-colors ${
                  preferencesForm.showLifeCalendar
                    ? 'border-[color:var(--accent-500)] bg-[color:var(--accent-600)]/40'
                    : 'border-slate-700 bg-slate-800'
                }`}
                onClick={() =>
                  setPreferencesForm((prev) => ({
                    ...prev,
                    showLifeCalendar: !prev.showLifeCalendar
                  }))
                }
              >
                <span
                  className={`h-4 w-4 rounded-full bg-white transition-transform ${
                    preferencesForm.showLifeCalendar ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className="text-xs text-slate-500">On</span>
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" className="rounded-lg bg-[color:var(--accent-600)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[color:var(--accent-500)]">
              Save changes
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-3 rounded-2xl bg-slate-800/70 p-4">
        <h2 className="text-lg font-semibold">Task tags</h2>
        <p className="text-sm text-slate-400">
          Create shared labels for tasks. These appear in the planner and let you filter analytics by tag.
        </p>
        <form
          className="flex flex-wrap items-center gap-2 text-sm"
          onSubmit={(event) => {
            event.preventDefault();
            const trimmed = tagInput.trim();
            if (!trimmed) {
              return;
            }
            actions.addTaskTag(trimmed);
            setTagInput('');
          }}
        >
          <input
            className="w-full max-w-xs rounded-lg bg-slate-900 px-3 py-2"
            placeholder="Add a tag (e.g. Personal)"
            value={tagInput}
            onChange={(event) => setTagInput(event.target.value)}
          />
          <button
            type="submit"
            className="rounded-lg bg-[color:var(--accent-600)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[color:var(--accent-500)]"
          >
            Add tag
          </button>
        </form>
        {state.taskTags.length === 0 ? (
          <p className="text-sm text-slate-400">No tags yet. Add your first tag above.</p>
        ) : (
          <div className="flex flex-wrap gap-2 text-sm">
            {state.taskTags.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1 text-slate-200">
                {tag}
                <button
                  type="button"
                  className="text-xs text-slate-400 hover:text-rose-300"
                  onClick={() => actions.removeTaskTag(tag)}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-2xl bg-slate-800/70 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Theme & mood</h2>
          <span className="text-xs text-slate-500">Current: {accentOptions.find((item) => item.key === preferencesForm.accentTheme)?.label ?? 'Aurora'}</span>
        </div>
        <p className="text-sm text-slate-400">Pick an accent palette that matches your energy. Changes apply instantly.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {accentOptions.map((option) => {
            const active = preferencesForm.accentTheme === option.key;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => handleAccentSelect(option.key)}
                className={`rounded-2xl border px-4 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${
                  active
                    ? 'border-[color:var(--accent-500)] bg-slate-900/70 ring-2 ring-[color:var(--accent-ring)] ring-offset-2 ring-offset-slate-900'
                    : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                }`}
                aria-pressed={active}
              >
                <span className={`block h-16 w-full rounded-2xl ${option.swatch}`} />
                <div className="mt-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-100">{option.label}</p>
                    <p className="text-xs text-slate-400">{option.description}</p>
                  </div>
                  {active && <span className="text-xs font-semibold text-[color:var(--accent-300)]">Active</span>}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl bg-slate-800/70 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Surface tone</h2>
          <span className="text-xs text-slate-500">Current: {surfaceOptions.find((item) => item.key === preferencesForm.surfaceTheme)?.label ?? 'Indigo glow'}</span>
        </div>
        <p className="text-sm text-slate-400">Choose the backdrop ambience. Accents adapt automatically.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {surfaceOptions.map((option) => {
            const active = preferencesForm.surfaceTheme === option.key;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => handleSurfaceSelect(option.key)}
                className={`rounded-2xl border px-4 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${
                  active
                    ? 'border-[color:var(--accent-500)] bg-slate-900/70 ring-2 ring-[color:var(--accent-ring)] ring-offset-2 ring-offset-slate-900'
                    : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                }`}
                aria-pressed={active}
              >
                <span
                  className="block h-16 w-full rounded-2xl"
                  style={{ backgroundImage: option.preview, backgroundSize: 'cover', backgroundPosition: 'center' }}
                />
                <div className="mt-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-100">{option.label}</p>
                    <p className="text-xs text-slate-400">{option.description}</p>
                  </div>
                  {active && <span className="text-xs font-semibold text-[color:var(--accent-300)]">Active</span>}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl bg-slate-800/70 p-4">
        <h2 className="text-lg font-semibold">Export & import</h2>
        <p className="text-sm text-slate-400">
          Data stays on this device unless you export it. Importing will replace your current data.
        </p>
        <div className="flex flex-col gap-2 text-sm">
          <button
            className="rounded-lg bg-slate-900 px-4 py-2 text-left text-slate-100 hover:bg-slate-900/70"
            onClick={handleExport}
          >
            Export data
          </button>
          <label className="rounded-lg bg-slate-900 px-4 py-2 text-slate-100 hover:bg-slate-900/70">
            <span>Import from file</span>
            <input type="file" accept="application/json" className="hidden" onChange={handleImport} />
          </label>
        </div>
      </section>

      {statusMessage && <p className="text-sm text-[color:var(--accent-300)]">{statusMessage}</p>}
      {errorMessage && <p className="text-sm text-rose-300">{errorMessage}</p>}
    </div>
  );
}
