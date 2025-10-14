import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { useAppData } from '../context/AppDataContext';
import type { Reminder, ReminderSchedule } from '../types';
import { Portal } from './Portal';

interface ToastEntry {
  id: string;
  key: string;
  title: string;
  body?: string;
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function ReminderTicker() {
  const {
    state: { reminders }
  } = useAppData();
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const lastFiredRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const ids = new Set(reminders.map((reminder) => reminder.id));
    lastFiredRef.current.forEach((_, id) => {
      if (!ids.has(id)) {
        lastFiredRef.current.delete(id);
      }
    });
  }, [reminders]);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      reminders.forEach((reminder) => {
        const last = lastFiredRef.current.get(reminder.id);
        if (shouldTrigger(reminder, now, last)) {
          lastFiredRef.current.set(reminder.id, now.getTime());
          const key = `${reminder.id}-${now.getTime()}`;
          setToasts((prev) => [
            ...prev,
            {
              id: reminder.id,
              key,
              title: reminder.title,
              body: formatSchedule(reminder.schedule)
            }
          ]);
          setTimeout(() => {
            setToasts((prev) => prev.filter((toast) => toast.key !== key));
          }, 7000);
        }
      });
    };

    tick();
    const interval = window.setInterval(tick, 15000);
    return () => window.clearInterval(interval);
  }, [reminders]);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <Portal>
      <div className="fixed right-6 top-24 z-50 flex w-72 flex-col gap-2 text-sm">
        {toasts.map((toast) => (
          <div
            key={toast.key}
            className="rounded-2xl border border-slate-700 bg-slate-900/95 px-4 py-3 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-100">{toast.title}</p>
                {toast.body && <p className="text-xs text-slate-400">{toast.body}</p>}
              </div>
              <button
                type="button"
                className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300 hover:bg-slate-700"
                onClick={() => setToasts((prev) => prev.filter((item) => item.key !== toast.key))}
              >
                close
              </button>
            </div>
          </div>
        ))}
      </div>
    </Portal>
  );
}

function shouldTrigger(reminder: Reminder, now: Date, lastFired?: number): boolean {
  const schedule = reminder.schedule;
  const nowMs = now.getTime();
  const last = lastFired ?? new Date(reminder.createdAt).getTime();

  switch (schedule.type) {
    case 'every_minutes': {
      const intervalMs = schedule.intervalMinutes * MINUTE;
      return nowMs - last >= intervalMs;
    }
    case 'hourly': {
      if (now.getMinutes() !== schedule.minuteMark) {
        return false;
      }
      return nowMs - last >= HOUR - MINUTE / 2;
    }
    case 'daily': {
      if (!matchesTime(schedule.time, now)) {
        return false;
      }
      return nowMs - last >= DAY - 10 * MINUTE;
    }
    case 'weekly': {
      const isoDay = getIsoWeekday(now);
      if (!schedule.daysOfWeek.includes(isoDay) || !matchesTime(schedule.time, now)) {
        return false;
      }
      return nowMs - last >= 7 * DAY - 10 * MINUTE;
    }
    case 'monthly': {
      if (!matchesTime(schedule.time, now)) {
        return false;
      }
      if (!schedule.daysOfMonth.includes(now.getDate())) {
        return false;
      }
      return nowMs - last >= 27 * DAY;
    }
    case 'yearly': {
      if (!matchesTime(schedule.time, now)) {
        return false;
      }
      const todayKey = format(now, 'MM-dd');
      if (!schedule.dates.includes(todayKey)) {
        return false;
      }
      return nowMs - last >= 350 * DAY;
    }
    default:
      return false;
  }
}

function matchesTime(time: string, now: Date) {
  const [hours, minutes] = time.split(':').map((part) => Number.parseInt(part, 10));
  return now.getHours() === hours && now.getMinutes() === minutes;
}

function getIsoWeekday(date: Date): number {
  const jsDay = date.getDay();
  return (jsDay + 6) % 7;
}

function formatSchedule(schedule: ReminderSchedule): string | undefined {
  switch (schedule.type) {
    case 'every_minutes':
      return `Every ${schedule.intervalMinutes} minutes`;
    case 'hourly':
      return `Every hour at minute ${schedule.minuteMark}`;
    case 'daily':
      return `Daily at ${schedule.time}`;
    case 'weekly':
      return `Weekly on ${schedule.daysOfWeek
        .map((day) => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][day])
        .join(', ')} at ${schedule.time}`;
    case 'monthly':
      return `Monthly on days ${schedule.daysOfMonth.join(', ')} at ${schedule.time}`;
    case 'yearly':
      return `Yearly on ${schedule.dates.join(', ')} at ${schedule.time}`;
    default:
      return undefined;
  }
}
