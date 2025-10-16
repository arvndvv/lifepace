import { Suspense, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
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
  const {
    loading,
    state: { preferences }
  } = useAppData();

  useEffect(() => {
    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      const controller = new AbortController();
      const register = async () => {
        try {
          const base = import.meta.env.BASE_URL ?? '/';
          const baseURL = new URL(base, window.location.origin);
          const swURL = new URL('service-worker.js', baseURL);
          console.info('[PWA] Registering service worker', {
            baseURL: baseURL.href,
            scope: baseURL.pathname,
            swURL: swURL.href
          });
          const registration = await navigator.serviceWorker.register(swURL.href, {
            scope: baseURL.pathname
          });

          console.info('[PWA] Service worker registered', registration.scope);

          let refreshing = false;
          navigator.serviceWorker.addEventListener(
            'controllerchange',
            () => {
              if (refreshing) {
                return;
              }
              refreshing = true;
              window.location.reload();
            },
            { signal: controller.signal }
          );

          if (registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          }

          registration.addEventListener(
            'updatefound',
            () => {
              const { installing } = registration;
              if (!installing) {
                return;
              }
              installing.addEventListener('statechange', () => {
                if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                  installing.postMessage({ type: 'SKIP_WAITING' });
                }
              });
            },
            { signal: controller.signal }
          );
        } catch (error) {
          console.error('[PWA] Service worker registration failed', error);
        }
      };

      register();

      return () => controller.abort();
    }
    return undefined;
  }, []);

  useEffect(() => {
    const handlePrompt = (event: Event) => {
      console.info('[PWA] beforeinstallprompt fired');
    };
    window.addEventListener('beforeinstallprompt', handlePrompt);
    return () => window.removeEventListener('beforeinstallprompt', handlePrompt);
  }, []);

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
