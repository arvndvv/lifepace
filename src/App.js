import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Suspense, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useRegisterSW } from 'virtual:pwa-register/react';
import AppShell from './components/layout/AppShell';
import OnboardingModal from './components/onboarding/OnboardingModal';
import ReminderWatcher from './components/ReminderWatcher';
import { useAppData } from './context/AppDataContext';
import DashboardPage from './pages/Dashboard';
import TasksPage from './pages/Tasks';
import LifeSpanPage from './pages/LifeSpan';
import StatsPage from './pages/Stats';
import SettingsPage from './pages/Settings';
export default function App() {
    useRegisterSW({ immediate: true });
    const { loading, state: { preferences } } = useAppData();
    useEffect(() => {
        const accent = preferences.accentTheme ?? 'aurora';
        const surface = preferences.surfaceTheme ?? 'indigo';
        document.documentElement.setAttribute('data-theme', accent);
        document.documentElement.setAttribute('data-surface', surface);
    }, [preferences.accentTheme, preferences.surfaceTheme]);
    if (loading) {
        return (_jsx("div", { className: "flex min-h-screen items-center justify-center bg-slate-900 text-slate-300", children: "Loading your data\u2026" }));
    }
    return (_jsxs(_Fragment, { children: [_jsx(ReminderWatcher, {}), _jsx(OnboardingModal, {}), _jsx(Suspense, { fallback: _jsx("div", { className: "p-4 text-slate-300", children: "Loading\u2026" }), children: _jsx(Routes, { children: _jsxs(Route, { element: _jsx(AppShell, {}), children: [_jsx(Route, { index: true, element: _jsx(DashboardPage, {}) }), _jsx(Route, { path: "/tasks", element: _jsx(TasksPage, {}) }), _jsx(Route, { path: "/lifespan", element: _jsx(LifeSpanPage, {}) }), _jsx(Route, { path: "/stats", element: _jsx(StatsPage, {}) }), _jsx(Route, { path: "/settings", element: _jsx(SettingsPage, {}) })] }) }) })] }));
}
