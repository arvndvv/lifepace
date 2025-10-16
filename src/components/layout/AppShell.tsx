import { NavLink, Outlet } from 'react-router-dom';
import { ReminderTicker } from '../ReminderTicker';

const iconSize = 'h-5 w-5';

const TodayIcon = () => (
  <svg viewBox="0 0 24 24" className={iconSize} fill="none" stroke="currentColor" strokeWidth="1.6">
    <rect x="3.5" y="5" width="17" height="15" rx="3" className="fill-slate-900/60" />
    <path d="M7 3v4M17 3v4" strokeLinecap="round" />
    <path d="M4 9h16" strokeLinecap="round" />
    <circle cx="12" cy="14" r="2.3" className="fill-current" />
  </svg>
);

const TasksIcon = () => (
  <svg viewBox="0 0 24 24" className={iconSize} fill="none" stroke="currentColor" strokeWidth="1.6">
    <rect x="4" y="5" width="16" height="14" rx="3" className="fill-slate-900/60" />
    <path d="M8 9.5h8M8 13h5" strokeLinecap="round" />
    <path d="m6.5 10 1.5 1.5 3-3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const LifeIcon = () => (
  <svg viewBox="0 0 24 24" className={iconSize} fill="none" stroke="currentColor" strokeWidth="1.6">
    <rect x="4" y="4" width="16" height="16" rx="4" className="fill-slate-900/60" />
    <path d="M8 8h0.01M12 8h0.01M16 8h0.01M8 12h0.01M12 12h0.01M16 12h0.01M8 16h0.01M12 16h0.01M16 16h0.01" strokeLinecap="round" />
  </svg>
);

const StatsIcon = () => (
  <svg viewBox="0 0 24 24" className={iconSize} fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M5 19V9.5M10 19V5M15 19v-6M20 19v-9" strokeLinecap="round" className="stroke-current" />
    <path d="M4 19h16" strokeLinecap="round" />
  </svg>
);

const SettingsIcon = () => (
  <svg viewBox="0 0 24 24" className={iconSize} fill="none" stroke="currentColor" strokeWidth="1.6">
    <path
      d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Zm6.6-3.2a1.1 1.1 0 0 0 .72-1.9l-1.1-.9a7.3 7.3 0 0 0 .07-1.1l1.05-.83a1.1 1.1 0 0 0-.7-1.95l-1.36.05a7.32 7.32 0 0 0-.95-.82l.18-1.34A1.1 1.1 0 0 0 15.5 2l-1.2.74a7.36 7.36 0 0 0-1.3-.2L12.7 1a1.1 1.1 0 0 0-1.4 0l-.3 1.54a7.36 7.36 0 0 0-1.3.2L8.5 2a1.1 1.1 0 0 0-1.6 1.04l.18 1.34a7.32 7.32 0 0 0-.95.82l-1.36-.05a1.1 1.1 0 0 0-.7 1.95l1.05.83c-.03.35-.03.7.07 1.1l-1.1.9a1.1 1.1 0 0 0 .72 1.9l1.38-.1c.26.33.54.63.86.9l-.23 1.35A1.1 1.1 0 0 0 7.9 20l1.24-.76c.42.17.86.3 1.32.39L10.8 21a1.1 1.1 0 0 0 2.4 0l.34-1.37c.46-.08.9-.22 1.32-.39l1.24.76a1.1 1.1 0 0 0 1.63-1.04l-.23-1.35c.32-.27.6-.57.86-.9l1.38.1Z"
      className="stroke-current"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const navItems = [
  { to: '/', label: 'Today', icon: <TodayIcon /> },
  { to: '/tasks', label: 'Tasks', icon: <TasksIcon /> },
  { to: '/lifespan', label: 'Life', icon: <LifeIcon /> },
  // { to: '/stats', label: 'Stats', icon: <StatsIcon /> },
  { to: '/settings', label: 'Settings', icon: <SettingsIcon /> }
];

export default function AppShell() {
  return (
    <div className="min-h-screen bg-transparent">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col bg-slate-900/90 backdrop-blur md:rounded-3xl md:border md:border-slate-800/80 md:px-8 md:py-6 md:shadow-[0_25px_60px_-20px_rgba(15,23,42,0.8)]">
        <header className="hidden md:flex flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-0">
          <div >
            <h1 className="text-2xl font-semibold text-slate-100">LifePace</h1>
            <p className="text-sm text-slate-400">Design your weeks, honour your life.</p>
          </div>
          <nav className="hidden items-center gap-2 md:flex">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[color:var(--accent-600)] text-white shadow-[0_18px_40px_-24px_var(--accent-shadow-strong)]'
                      : 'text-slate-300 hover:bg-slate-800/60'
                  }`
                }
              >
                <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/70">
                  {item.icon}
                </span>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </header>

        <main className="flex-1 px-4 pb-20 pt-5 md:pt-0 md:px-0 md:pb-8">
          <Outlet />
        </main>

        <nav className="sticky bottom-0 flex w-full justify-around border-t border-slate-800 bg-slate-950/95 py-2 backdrop-blur md:hidden">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 rounded-md px-3 py-2 text-xs transition-colors ${
                  isActive
                    ? 'bg-[color:var(--accent-600-soft)] text-[color:var(--accent-200)]'
                    : 'text-slate-400'
                }`
              }
            >
              <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900/70">
                {item.icon}
              </span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <ReminderTicker />
      </div>
    </div>
  );
}
