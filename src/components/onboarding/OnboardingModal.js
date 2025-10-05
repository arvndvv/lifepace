import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useAppData } from '../../context/AppDataContext';
import { useNotifications } from '../../hooks/useNotifications';
import { getTodayISO } from '../../utils/date';
export default function OnboardingModal() {
    const { state: { profile }, actions } = useAppData();
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
    const onSubmit = async (event) => {
        event.preventDefault();
        let allowNotifications = form.allowNotifications;
        if (allowNotifications && permission !== 'granted') {
            const result = await requestPermission();
            allowNotifications = result === 'granted';
        }
        const nextProfile = {
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
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur", children: _jsxs("form", { className: "w-full max-w-md space-y-4 rounded-2xl bg-slate-900 p-6 shadow-xl", onSubmit: onSubmit, children: [_jsxs("div", { children: [_jsx("h2", { className: "text-xl font-semibold", children: "Welcome to LifePace" }), _jsx("p", { className: "text-sm text-slate-400", children: "A few details help personalise your dashboard." })] }), _jsxs("label", { className: "block space-y-1", children: [_jsx("span", { className: "text-sm text-slate-300", children: "Name" }), _jsx("input", { required: true, value: form.name, onChange: (event) => setForm((prev) => ({ ...prev, name: event.target.value })), className: "w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-100", placeholder: "Your name" })] }), _jsxs("label", { className: "block space-y-1", children: [_jsx("span", { className: "text-sm text-slate-300", children: "Date of birth" }), _jsx("input", { required: true, type: "date", value: form.dateOfBirth, onChange: (event) => setForm((prev) => ({ ...prev, dateOfBirth: event.target.value })), max: getTodayISO(), className: "w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-100" })] }), _jsxs("label", { className: "flex items-center gap-3 rounded-lg bg-slate-800 px-3 py-2", children: [_jsx("input", { type: "checkbox", checked: form.allowNotifications, onChange: (event) => setForm((prev) => ({ ...prev, allowNotifications: event.target.checked })) }), _jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-slate-200", children: "Enable reminders" }), _jsx("p", { className: "text-xs text-slate-400", children: "We will only use local notifications." })] })] }), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx("button", { type: "button", className: "rounded-lg px-3 py-2 text-sm text-slate-400", onClick: () => setIsOpen(false), children: "Close" }), _jsx("button", { type: "submit", className: "rounded-lg bg-[color:var(--accent-600)] px-4 py-2 text-sm font-semibold text-white shadow transition-colors hover:bg-[color:var(--accent-500)]", children: "Save & start" })] })] }) }));
}
