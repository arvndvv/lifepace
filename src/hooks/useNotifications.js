import { useCallback, useEffect, useState } from 'react';
function isSupported() {
    return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
}
function supportsTriggers() {
    if (!isSupported()) {
        return false;
    }
    return 'showTrigger' in Notification.prototype;
}
export function useNotifications() {
    const [permission, setPermission] = useState(() => isSupported() ? Notification.permission : 'unsupported');
    useEffect(() => {
        if (!isSupported()) {
            setPermission('unsupported');
            return;
        }
        setPermission(Notification.permission);
    }, []);
    const requestPermission = useCallback(async () => {
        if (!isSupported()) {
            setPermission('unsupported');
            return 'unsupported';
        }
        const result = await Notification.requestPermission();
        setPermission(result);
        return result;
    }, []);
    const showReminderNow = useCallback(async (task) => {
        if (!isSupported()) {
            return;
        }
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification?.('LifePace reminder', {
            body: `${task.title} is waiting for you`,
            tag: `task-${task.id}`,
            data: { taskId: task.id }
        });
    }, []);
    const scheduleReminder = useCallback(async (task) => {
        if (!isSupported() || permission !== 'granted' || !task.reminderAt) {
            return;
        }
        const reminderTime = new Date(task.reminderAt).getTime();
        if (Number.isNaN(reminderTime)) {
            return;
        }
        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.getNotifications?.({ tag: `task-${task.id}` });
        existing?.forEach((note) => note.close());
        if (supportsTriggers() && window.TimestampTrigger) {
            const trigger = new window.TimestampTrigger(reminderTime);
            await registration.showNotification?.('LifePace reminder', {
                body: `${task.title} starts soon`,
                tag: `task-${task.id}`,
                data: { taskId: task.id },
                showTrigger: trigger
            });
        }
        else {
            if (reminderTime <= Date.now()) {
                await showReminderNow(task);
            }
        }
    }, [permission, showReminderNow]);
    const cancelReminder = useCallback(async (taskId) => {
        if (!isSupported()) {
            return;
        }
        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.getNotifications?.({ tag: `task-${taskId}` });
        existing?.forEach((note) => note.close());
    }, []);
    return { permission, requestPermission, scheduleReminder, cancelReminder };
}
