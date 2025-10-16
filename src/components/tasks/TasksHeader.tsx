import { format, startOfMonth, startOfWeek } from "date-fns";
import { TaskViewRange } from "../../pages/Tasks";
import { getTodayISO } from "../../utils/date";
import { formatMinutes } from "../../utils/tasks";

interface ISelectedDate {
    length: number;
    id?: string;
    title?: string;
    assignedMinutes?: number;
    spentMinutes?: number;
}[];
interface TasksHeaderProps {
    rangeFilter: string;
    setSelectedDate: (date: string) => void;
    setRangeFilter: (filter: TaskViewRange) => void;
    selectedDayTasks: ISelectedDate;
    selectedDaySummary: {
        assignedMinutes: number;
        spentMinutes: number;
    };
    selectedDayAllocation: {
        assigned: number;
        remaining: number;
    };
    selectedDateLabel: string;
    moveWeek: (offset: number) => void;
    weekCursor: Date;
    setWeekCursor: (date: Date) => void;
    monthCursor: Date;
    setMonthCursor: (date: Date) => void;
    moveMonth: (offset: number) => void;
}
export default function TasksHeader({
    rangeFilter = 'today',
    setSelectedDate,
    setRangeFilter,
    selectedDayTasks,
    selectedDaySummary,
    selectedDayAllocation,
    selectedDateLabel,
    moveWeek,
    weekCursor,
    setWeekCursor,
    monthCursor,
    setMonthCursor,
    moveMonth
}: TasksHeaderProps) {
    const today = getTodayISO();

    if (rangeFilter === 'today') {
        return (
            <header className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <div>
                    <h2 className="text-lg font-semibold text-slate-200">{selectedDateLabel}</h2>
                    <p className="text-xs text-slate-400">
                        {selectedDayTasks.length} task{selectedDayTasks.length === 1 ? '' : 's'} • Assigned{' '}
                        {formatMinutes(selectedDaySummary.assignedMinutes)} • Spent {formatMinutes(selectedDaySummary.spentMinutes)} • Active load{' '}
                        {formatMinutes(selectedDayAllocation.assigned)} • Time left {formatMinutes(selectedDayAllocation.remaining)}
                    </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                    <button
                        type="button"
                        className="rounded-full bg-slate-800 px-3 py-1 hover:bg-slate-700"
                        onClick={() => {
                            setSelectedDate(today);
                            setRangeFilter('today');
                        }}
                    >
                        Jump to today
                    </button>
                </div>
            </header>
        )
    }
    if (rangeFilter === 'week') {
        return (<header className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
                <h2 className="text-lg font-semibold text-slate-200">Week of {format(weekCursor, 'MMM d')}</h2>
                <p className="text-xs text-slate-400">Select a day to jump into the detailed view.</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
                <button
                    type="button"
                    className="rounded-full bg-slate-800 px-3 py-1 hover:bg-slate-700"
                    onClick={() => moveWeek(-1)}
                >
                    Previous
                </button>
                <button
                    type="button"
                    className="rounded-full bg-slate-800 px-3 py-1 hover:bg-slate-700"
                    onClick={() => {
                        setWeekCursor(startOfWeek(new Date(), { weekStartsOn: 1 }));
                        setSelectedDate(today);
                    }}
                >
                    This week
                </button>
                <button
                    type="button"
                    className="rounded-full bg-slate-800 px-3 py-1 hover:bg-slate-700"
                    onClick={() => moveWeek(1)}
                >
                    Next
                </button>
            </div>
        </header>)
    }
    if(rangeFilter === 'month'){
        return (
            <header className="flex flex-wrap items-center justify-between gap-3 mb-5">
                        <div>
                          <h2 className="text-lg font-semibold text-slate-200">{format(monthCursor, 'MMMM yyyy')}</h2>
                          <p className="text-xs text-slate-400">Click a day to open it in the Today view.</p>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <button
                            type="button"
                            className="rounded-full bg-slate-800 px-3 py-1 hover:bg-slate-700"
                            onClick={() => moveMonth(-1)}
                          >
                            Previous
                          </button>
                          <button
                            type="button"
                            className="rounded-full bg-slate-800 px-3 py-1 hover:bg-slate-700"
                            onClick={() => {
                              const now = new Date();
                              setMonthCursor(startOfMonth(now));
                              setSelectedDate(format(now, 'yyyy-MM-dd'));
                            }}
                          >
                            This month
                          </button>
                          <button
                            type="button"
                            className="rounded-full bg-slate-800 px-3 py-1 hover:bg-slate-700"
                            onClick={() => moveMonth(1)}
                          >
                            Next
                          </button>
                        </div>
                      </header>
        )
    }
    if(rangeFilter === 'all'){
        return (
            <header className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <div>
                    <h2 className="text-lg font-semibold text-slate-200">All tasks</h2>
                    <p className="text-xs text-slate-400">A list of all your tasks across all dates.</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                    <button
                        type="button"
                        className="rounded-full bg-slate-800 px-3 py-1 hover:bg-slate-700"
                        onClick={() => {
                            setSelectedDate(today);
                            setRangeFilter('today');
                        }}
                    >
                        Jump to today
                    </button>
                </div>
            </header>
               
        )
    }


}