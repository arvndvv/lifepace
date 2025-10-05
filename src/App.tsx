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
  const {
    loading,
    state: { preferences }
  } = useAppData();

  useEffect(() => {
    const accent = preferences.accentTheme ?? 'aurora';
    const surface = preferences.surfaceTheme ?? 'indigo';
    document.documentElement.setAttribute('data-theme', accent);
    document.documentElement.setAttribute('data-surface', surface);
  }, [preferences.accentTheme, preferences.surfaceTheme]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-slate-300">
        Loading your data…
      </div>
    );
  }

  return (
    <>
      <ReminderWatcher />
      <OnboardingModal />
      <Suspense fallback={<div className="p-4 text-slate-300">Loading…</div>}>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<DashboardPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/lifespan" element={<LifeSpanPage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}
