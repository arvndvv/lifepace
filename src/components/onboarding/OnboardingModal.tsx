import { FormEvent, useEffect, useState } from 'react';
import { useAppData } from '../../context/AppDataContext';
import { useNotifications } from '../../hooks/useNotifications';
import type { UserProfile } from '../../types';
import { getTodayISO } from '../../utils/date';

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
      >
        <div>
          <h2 className="text-xl font-semibold">Welcome to LifePace</h2>
          <p className="text-sm text-slate-400">A few details help personalise your dashboard.</p>
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

        <label className="flex items-center gap-3 rounded-lg bg-slate-800 px-3 py-2">
          <input
            type="checkbox"
            checked={form.allowNotifications}
            onChange={(event) => setForm((prev) => ({ ...prev, allowNotifications: event.target.checked }))}
          />
          <div>
            <p className="text-sm font-medium text-slate-200">Enable reminders</p>
            <p className="text-xs text-slate-400">We will only use local notifications.</p>
          </div>
        </label>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="rounded-lg px-3 py-2 text-sm text-slate-400"
            onClick={() => setIsOpen(false)}
          >
            Close
          </button>
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
