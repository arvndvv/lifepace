# LifePace

LifePace is a local-first progressive web app for planning your days and tracking progress through both tasks and a lifespan calendar. It is built with React, TypeScript, Vite, Tailwind CSS, and the Vite PWA plugin.

## Features

- Daily 24-hour breakdown showing elapsed vs remaining time based on your preferred schedule
- Weekly grid visualising every week of your life to your chosen life expectancy (inspired by the GitHub activity matrix)
- Task planning with statuses (`planned`, `in_progress`, `completed`, `skipped`), reminders, editing, and deletion
- Local notifications (where supported) for task reminders via the browser Notifications API
- Historical stats summarising weekly, monthly, and yearly task outcomes
- Onboarding captures name & date of birth so insights are personal; all data persists locally via IndexedDB + localStorage cache
- Manual export/import of your data as JSON to keep backups without needing a remote database

## Getting Started

1. Install dependencies (requires Node 18+):
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Build for production:
   ```bash
   npm run build
   ```

## Notes

- The PWA manifest/service worker is handled by `@vite-pwa/react`; the app can be installed on mobile or desktop browsers that support PWAs.
- Notifications rely on the Notifications API and may be limited on some browsers or platforms. The app automatically falls back to in-app reminders when push-style notifications are unavailable.
- All data is stored locally (IndexedDB). Use the Settings page to export/import your data if you need to migrate devices.
