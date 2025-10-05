import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { useAppData } from '../context/AppDataContext';
import { useNotifications } from '../hooks/useNotifications';
import { createExportPayload, parseImportedPayload } from '../utils/storage';
export default function SettingsPage() {
    const { state, actions } = useAppData();
    const { permission, requestPermission } = useNotifications();
    const profile = state.profile;
    const [statusMessage, setStatusMessage] = useState(null);
    const [errorMessage, setErrorMessage] = useState(null);
    const [form, setForm] = useState(() => profile
        ? {
            name: profile.name,
            dateOfBirth: profile.dateOfBirth,
            lifeExpectancyYears: profile.lifeExpectancyYears,
            dayStartHour: profile.dayStartHour,
            dayEndHour: profile.dayEndHour,
            allowNotifications: profile.allowNotifications
        }
        : null);
    const [preferencesForm, setPreferencesForm] = useState(() => ({
        reminderLeadMinutes: state.preferences.reminderLeadMinutes,
        defaultReminderTime: state.preferences.defaultReminderTime ?? '',
        accentTheme: state.preferences.accentTheme ?? 'aurora',
        surfaceTheme: state.preferences.surfaceTheme ?? 'indigo'
    }));
    const accentOptions = [
        {
            key: 'aurora',
            label: 'Aurora',
            description: 'Fresh teal energy',
            swatch: 'bg-gradient-to-r from-emerald-300 via-emerald-400 to-cyan-400'
        },
        {
            key: 'forest',
            label: 'Forest',
            description: 'Deep woodland greens',
            swatch: 'bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-700'
        },
        {
            key: 'sunset',
            label: 'Sunset',
            description: 'Warm amber glow',
            swatch: 'bg-gradient-to-r from-amber-300 via-orange-400 to-rose-400'
        },
        {
            key: 'midnight',
            label: 'Midnight',
            description: 'Moody indigo nights',
            swatch: 'bg-gradient-to-r from-slate-400 via-indigo-500 to-slate-600'
        }
    ];
    const surfaceOptions = [
        {
            key: 'indigo',
            label: 'Indigo glow',
            description: 'Original aurora haze',
            preview: 'linear-gradient(180deg, #020617 0%, #0f172a 60%, #020617 100%)'
        },
        {
            key: 'midnight',
            label: 'Midnight velvet',
            description: 'Deep navy with soft bloom',
            preview: 'linear-gradient(180deg, #020617 0%, #111827 60%, #030712 100%)'
        },
        {
            key: 'slate',
            label: 'Slate calm',
            description: 'Balanced grey-blue dusk',
            preview: 'linear-gradient(180deg, #0b1120 0%, #1e293b 60%, #0b1120 100%)'
        },
        {
            key: 'charcoal',
            label: 'Charcoal focus',
            description: 'Minimal graphite night',
            preview: 'linear-gradient(180deg, #050608 0%, #101828 50%, #0b0f1a 100%)'
        }
    ];
    const handleAccentSelect = (accent) => {
        if (preferencesForm.accentTheme === accent) {
            return;
        }
        const option = accentOptions.find((item) => item.key === accent);
        setPreferencesForm((prev) => ({ ...prev, accentTheme: accent }));
        actions.setPreferences({ accentTheme: accent });
        setStatusMessage(option ? `Accent theme set to ${option.label}` : 'Accent updated');
        setErrorMessage(null);
    };
    const handleSurfaceSelect = (surface) => {
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
    if (!profile || !form) {
        return _jsx("p", { className: "text-sm text-slate-400", children: "Complete onboarding to access settings." });
    }
    const onSubmit = (event) => {
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
            surfaceTheme: preferencesForm.surfaceTheme
        });
        setStatusMessage('Preferences updated');
        setErrorMessage(null);
    };
    const toggleNotifications = async (enabled) => {
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
    const handleImport = async (event) => {
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
                surfaceTheme: importedState.preferences.surfaceTheme ?? 'indigo'
            });
        }
        catch (error) {
            console.error(error);
            setErrorMessage('Import failed. Please ensure the file was exported from LifePace.');
        }
        finally {
            event.target.value = '';
        }
    };
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("section", { className: "rounded-2xl bg-slate-800/70 p-4", children: [_jsx("h2", { className: "text-lg font-semibold", children: "Profile & preferences" }), _jsxs("form", { className: "mt-4 space-y-3 text-sm", onSubmit: onSubmit, children: [_jsxs("label", { className: "block space-y-1", children: [_jsx("span", { className: "text-slate-300", children: "Name" }), _jsx("input", { className: "w-full rounded-lg bg-slate-900 px-3 py-2", value: form.name, onChange: (event) => setForm((prev) => prev && { ...prev, name: event.target.value }) })] }), _jsxs("label", { className: "block space-y-1", children: [_jsx("span", { className: "text-slate-300", children: "Date of birth" }), _jsx("input", { type: "date", className: "w-full rounded-lg bg-slate-900 px-3 py-2", value: form.dateOfBirth, onChange: (event) => setForm((prev) => prev && { ...prev, dateOfBirth: event.target.value }) })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("label", { className: "space-y-1", children: [_jsx("span", { className: "text-slate-300", children: "Day starts" }), _jsx("input", { type: "number", min: 0, max: 23, className: "w-full rounded-lg bg-slate-900 px-3 py-2", value: form.dayStartHour, onChange: (event) => setForm((prev) => prev && { ...prev, dayStartHour: Number.parseInt(event.target.value, 10) || 0 }) })] }), _jsxs("label", { className: "space-y-1", children: [_jsx("span", { className: "text-slate-300", children: "Day ends" }), _jsx("input", { type: "number", min: 1, max: 24, className: "w-full rounded-lg bg-slate-900 px-3 py-2", value: form.dayEndHour, onChange: (event) => setForm((prev) => prev && { ...prev, dayEndHour: Number.parseInt(event.target.value, 10) || 24 }) })] })] }), _jsxs("label", { className: "block space-y-1", children: [_jsx("span", { className: "text-slate-300", children: "Life expectancy" }), _jsx("input", { type: "number", min: 40, max: 120, className: "w-full rounded-lg bg-slate-900 px-3 py-2", value: form.lifeExpectancyYears, onChange: (event) => setForm((prev) => prev && {
                                            ...prev,
                                            lifeExpectancyYears: Number.parseInt(event.target.value, 10) || prev.lifeExpectancyYears
                                        }) })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("label", { className: "space-y-1", children: [_jsx("span", { className: "text-slate-300", children: "Reminder lead (minutes)" }), _jsx("input", { type: "number", min: 0, max: 720, className: "w-full rounded-lg bg-slate-900 px-3 py-2", value: preferencesForm.reminderLeadMinutes, onChange: (event) => setPreferencesForm((prev) => ({
                                                    ...prev,
                                                    reminderLeadMinutes: Number.parseInt(event.target.value, 10) || 0
                                                })) })] }), _jsxs("label", { className: "space-y-1", children: [_jsx("span", { className: "text-slate-300", children: "Default reminder time" }), _jsx("input", { type: "time", className: "w-full rounded-lg bg-slate-900 px-3 py-2", value: preferencesForm.defaultReminderTime, onChange: (event) => setPreferencesForm((prev) => ({ ...prev, defaultReminderTime: event.target.value })) })] })] }), _jsxs("div", { className: "flex items-center justify-between rounded-xl bg-slate-900/60 px-3 py-2", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm text-slate-200", children: "Reminders" }), _jsx("p", { className: "text-xs text-slate-400", children: "Push-style notifications when tasks are due" })] }), _jsxs("label", { className: "inline-flex items-center gap-2", children: [_jsx("span", { className: "text-xs text-slate-400", children: "Off" }), _jsx("input", { type: "checkbox", checked: form.allowNotifications, onChange: (event) => toggleNotifications(event.target.checked) }), _jsx("span", { className: "text-xs text-slate-400", children: "On" })] })] }), _jsx("div", { className: "flex justify-end", children: _jsx("button", { type: "submit", className: "rounded-lg bg-[color:var(--accent-600)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[color:var(--accent-500)]", children: "Save changes" }) })] })] }), _jsxs("section", { className: "space-y-3 rounded-2xl bg-slate-800/70 p-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "text-lg font-semibold", children: "Theme & mood" }), _jsxs("span", { className: "text-xs text-slate-500", children: ["Current: ", accentOptions.find((item) => item.key === preferencesForm.accentTheme)?.label ?? 'Aurora'] })] }), _jsx("p", { className: "text-sm text-slate-400", children: "Pick an accent palette that matches your energy. Changes apply instantly." }), _jsx("div", { className: "grid grid-cols-1 gap-3 sm:grid-cols-2", children: accentOptions.map((option) => {
                            const active = preferencesForm.accentTheme === option.key;
                            return (_jsxs("button", { type: "button", onClick: () => handleAccentSelect(option.key), className: `rounded-2xl border px-4 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${active
                                    ? 'border-[color:var(--accent-500)] bg-slate-900/70 ring-2 ring-[color:var(--accent-ring)] ring-offset-2 ring-offset-slate-900'
                                    : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'}`, "aria-pressed": active, children: [_jsx("span", { className: `block h-16 w-full rounded-2xl ${option.swatch}` }), _jsxs("div", { className: "mt-3 flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "font-medium text-slate-100", children: option.label }), _jsx("p", { className: "text-xs text-slate-400", children: option.description })] }), active && _jsx("span", { className: "text-xs font-semibold text-[color:var(--accent-300)]", children: "Active" })] })] }, option.key));
                        }) })] }), _jsxs("section", { className: "space-y-3 rounded-2xl bg-slate-800/70 p-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "text-lg font-semibold", children: "Surface tone" }), _jsxs("span", { className: "text-xs text-slate-500", children: ["Current: ", surfaceOptions.find((item) => item.key === preferencesForm.surfaceTheme)?.label ?? 'Indigo glow'] })] }), _jsx("p", { className: "text-sm text-slate-400", children: "Choose the backdrop ambience. Accents adapt automatically." }), _jsx("div", { className: "grid grid-cols-1 gap-3 sm:grid-cols-2", children: surfaceOptions.map((option) => {
                            const active = preferencesForm.surfaceTheme === option.key;
                            return (_jsxs("button", { type: "button", onClick: () => handleSurfaceSelect(option.key), className: `rounded-2xl border px-4 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${active
                                    ? 'border-[color:var(--accent-500)] bg-slate-900/70 ring-2 ring-[color:var(--accent-ring)] ring-offset-2 ring-offset-slate-900'
                                    : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'}`, "aria-pressed": active, children: [_jsx("span", { className: "block h-16 w-full rounded-2xl", style: { backgroundImage: option.preview, backgroundSize: 'cover', backgroundPosition: 'center' } }), _jsxs("div", { className: "mt-3 flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "font-medium text-slate-100", children: option.label }), _jsx("p", { className: "text-xs text-slate-400", children: option.description })] }), active && _jsx("span", { className: "text-xs font-semibold text-[color:var(--accent-300)]", children: "Active" })] })] }, option.key));
                        }) })] }), _jsxs("section", { className: "space-y-3 rounded-2xl bg-slate-800/70 p-4", children: [_jsx("h2", { className: "text-lg font-semibold", children: "Export & import" }), _jsx("p", { className: "text-sm text-slate-400", children: "Data stays on this device unless you export it. Importing will replace your current data." }), _jsxs("div", { className: "flex flex-col gap-2 text-sm", children: [_jsx("button", { className: "rounded-lg bg-slate-900 px-4 py-2 text-left text-slate-100 hover:bg-slate-900/70", onClick: handleExport, children: "Export data" }), _jsxs("label", { className: "rounded-lg bg-slate-900 px-4 py-2 text-slate-100 hover:bg-slate-900/70", children: [_jsx("span", { children: "Import from file" }), _jsx("input", { type: "file", accept: "application/json", className: "hidden", onChange: handleImport })] })] })] }), statusMessage && _jsx("p", { className: "text-sm text-[color:var(--accent-300)]", children: statusMessage }), errorMessage && _jsx("p", { className: "text-sm text-rose-300", children: errorMessage })] }));
}
