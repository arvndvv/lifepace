import { useEffect } from 'react';
import { useAppData } from '../context/AppDataContext';
import { useNotifications } from '../hooks/useNotifications';

export default function ReminderWatcher() {
  const {
    state: { tasks, profile }
  } = useAppData();
  const { permission, scheduleReminder, cancelReminder } = useNotifications();

  useEffect(() => {
    if (!profile?.allowNotifications || permission !== 'granted') {
      tasks.forEach((task) => cancelReminder(task.id));
      return;
    }

    tasks.forEach((task) => {
      if (!task.reminderAt) {
        cancelReminder(task.id);
        return;
      }
      if (task.status === 'completed' || task.status === 'skipped') {
        cancelReminder(task.id);
        return;
      }
      const reminderTime = new Date(task.reminderAt).getTime();
      if (Number.isNaN(reminderTime) || reminderTime < Date.now() - 5 * 60 * 1000) {
        cancelReminder(task.id);
        return;
      }
      scheduleReminder(task);
    });
  }, [tasks, permission, profile?.allowNotifications, scheduleReminder, cancelReminder]);

  return null;
}
