import { FormEvent, useEffect, useState } from 'react';
import { useAppData } from '../../context/AppDataContext';
import { useNotifications } from '../../hooks/useNotifications';
import type { UserProfile } from '../../types';
import { getTodayISO } from '../../utils/date';
import { DialogCloseButton } from '../DialogCloseButton';

export default function OnboardingModal() {
  const {
    state: { profile },
    actions
  } = useAppData();
  const { permission, requestPermission } = useNotifications();
  const [isOpen, setIsOpen] = useState(!profile?.onboardingComplete);
  const [form, setForm] = useState({
    name: profile?.name ?? '',
    dateOfBirth: profile?.dateOfBirth ?? '',
    allowNotifications: profile?.allowNotifications ?? false
  });

  useEffect(() => {
    if (!profile?.onboardingComplete) {
      setIsOpen(true);
    }
  }, [profile]);

  if (!isOpen) {
    return null;
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    let allowNotifications = form.allowNotifications;
    if (allowNotifications && permission !== 'granted') {
      const result = await requestPermission();
      allowNotifications = result === 'granted';
    }

    const nextProfile: UserProfile = {
      name: form.name.trim(),
      dateOfBirth: form.dateOfBirth,
      dayStartHour: profile?.dayStartHour ?? 0,
      dayEndHour: profile?.dayEndHour ?? 24,
      lifeExpectancyYears: profile?.lifeExpectancyYears ?? 90,
      allowNotifications,
      onboardingComplete: true
    };

    actions.setProfile(nextProfile);
    setIsOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur">
      <form
        className="w-full max-w-md space-y-4 rounded-2xl bg-slate-900 p-6 shadow-xl"
        onSubmit={onSubmit}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-100">Welcome to LifePace</h2>
            <p className="text-sm text-slate-400">A few details help personalise your dashboard.</p>
          </div>
          <DialogCloseButton onClick={() => setIsOpen(false)} />
        </div>

        <label className="block space-y-1">
          <span className="text-sm text-slate-300">Name</span>
          <input
            required
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-100"
            placeholder="Your name"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-slate-300">Date of birth</span>
          <input
            required
            type="date"
            value={form.dateOfBirth}
            onChange={(event) => setForm((prev) => ({ ...prev, dateOfBirth: event.target.value }))}
            max={getTodayISO()}
            className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-100"
          />
        </label>

        <div className="flex items-center justify-between rounded-xl bg-slate-800/70 px-3 py-2">
          <div>
            <p className="text-sm font-medium text-slate-200">Enable reminders</p>
            <p className="text-xs text-slate-400">We will only use local notifications.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={form.allowNotifications}
            className={`flex h-6 w-12 items-center rounded-full border px-1 transition-colors ${
              form.allowNotifications
                ? 'border-[color:var(--accent-500)] bg-[color:var(--accent-600)]/40'
                : 'border-slate-700 bg-slate-800'
            }`}
            onClick={() =>
              setForm((prev) => ({ ...prev, allowNotifications: !prev.allowNotifications }))
            }
          >
            <span
              className={`h-4 w-4 rounded-full bg-white transition-transform ${
                form.allowNotifications ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-lg bg-[color:var(--accent-600)] px-4 py-2 text-sm font-semibold text-white shadow transition-colors hover:bg-[color:var(--accent-500)]"
          >
            Save & start
          </button>
        </div>
      </form>
    </div>
  );
}
