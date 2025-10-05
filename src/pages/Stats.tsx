import { useMemo } from 'react';
import { useAppData } from '../context/AppDataContext';
import { getPeriodRanges } from '../utils/date';
import { buildTaskSummary } from '../utils/stats';

export default function StatsPage() {
  const {
    state: { tasks }
  } = useAppData();

  const ranges = useMemo(() => getPeriodRanges(new Date()), []);
  const weekly = useMemo(() => buildTaskSummary(tasks, ranges.week), [tasks, ranges.week]);
  const monthly = useMemo(() => buildTaskSummary(tasks, ranges.month), [tasks, ranges.month]);
  const yearly = useMemo(() => buildTaskSummary(tasks, ranges.year), [tasks, ranges.year]);

  const summaries = [
    { label: 'This week', data: weekly },
    { label: 'This month', data: monthly },
    { label: 'This year', data: yearly }
  ];

  return (
    <div className="space-y-4">
      {summaries.map((item) => (
        <section key={item.label} className="rounded-2xl bg-slate-800/70 p-4 shadow">
          <header className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{item.label}</h2>
            <span className="text-xs text-slate-400">{item.data.total} tasks</span>
          </header>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-slate-400">Completed</dt>
              <dd className="text-xl font-semibold text-emerald-400">{item.data.counts.completed}</dd>
            </div>
            <div>
              <dt className="text-slate-400">In progress</dt>
              <dd className="text-xl font-semibold text-amber-300">{item.data.counts.in_progress}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Planned</dt>
              <dd className="text-xl font-semibold text-slate-200">{item.data.counts.planned}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Skipped</dt>
              <dd className="text-xl font-semibold text-rose-300">{item.data.counts.skipped}</dd>
            </div>
          </dl>
          <div className="mt-4 grid grid-cols-3 gap-3 text-xs text-slate-400">
            <div className="rounded-lg bg-slate-900/70 p-3">
              <p className="text-slate-300">Completion rate</p>
              <p className="text-lg font-semibold text-emerald-400">
                {(item.data.completionRate * 100).toFixed(0)}%
              </p>
            </div>
            <div className="rounded-lg bg-slate-900/70 p-3">
              <p className="text-slate-300">Started</p>
              <p className="text-lg font-semibold text-amber-300">
                {(item.data.startedRate * 100).toFixed(0)}%
              </p>
            </div>
            <div className="rounded-lg bg-slate-900/70 p-3">
              <p className="text-slate-300">Dropped</p>
              <p className="text-lg font-semibold text-rose-300">
                {(item.data.droppedRate * 100).toFixed(0)}%
              </p>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
