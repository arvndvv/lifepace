export type TaskStatus = 'planned' | 'in_progress' | 'completed' | 'skipped';

export type AccentTheme = 'aurora' | 'forest' | 'sunset' | 'midnight';
export type SurfaceTheme = 'indigo' | 'midnight' | 'slate' | 'charcoal';

export interface Task {
  id: string;
  title: string;
  description?: string;
  scheduledFor: string; // ISO date string representing the day the task belongs to
  startAt?: string; // ISO datetime for task start
  deadlineAt?: string; // ISO datetime for optional deadline
  reminderAt?: string; // ISO datetime for reminders
  durationMinutes?: number; // Total minutes allocated when using duration-based planning
  progressive: boolean; // Marks this task as contributing towards day progress
  tags: string[];
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}

export type ReflectionTag = 'none' | 'learned' | 'progressed' | 'advanced' | 'enjoyed';

export interface UserProfile {
  name: string;
  dateOfBirth: string; // ISO date
  lifeExpectancyYears: number;
  dayStartHour: number;
  dayEndHour: number;
  allowNotifications: boolean;
  onboardingComplete: boolean;
}

export interface Preferences {
  reminderLeadMinutes: number;
  defaultReminderTime?: string; // HH:mm format
  accentTheme: AccentTheme;
  surfaceTheme: SurfaceTheme;
  dayFulfillmentThreshold: number; // percentage 10-100
  weekFulfillmentTarget: number; // days 1-7
  progressiveTasksPerDay: number; // min progressive tasks to mark a day progressed
  progressiveDaysForWeekWin: number; // progressed days needed for automatic week win
  showLifeCalendar: boolean; // toggles weeks-of-life grid visibility
}

export interface ReflectionEntry {
  tag: ReflectionTag;
  color?: string;
}

export interface WeekWinEntry {
  status: 'auto' | 'manual';
  fulfilled: boolean;
}

export type ReminderSchedule =
  | { type: 'every_minutes'; intervalMinutes: number }
  | { type: 'hourly'; minuteMark: number }
  | { type: 'daily'; time: string }
  | { type: 'weekly'; daysOfWeek: number[]; time: string }
  | { type: 'monthly'; daysOfMonth: number[]; time: string }
  | { type: 'yearly'; dates: string[]; time: string }; // dates formatted MM-DD

export interface Reminder {
  id: string;
  title: string;
  description?: string;
  schedule: ReminderSchedule;
  createdAt: string;
  updatedAt: string;
}

export interface LifeGoalNode {
  id: string;
  title: string;
  description?: string;
  x: number;
  y: number;
}

export interface LifeGoalLink {
  id: string;
  sourceId: string;
  targetId: string;
}

export interface DaySummary {
  date: string;
  completionRate: number;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  progressiveTasks: number;
  progressed: boolean;
  weekId: string;
  fulfilled: boolean;
}

export interface AppState {
  profile?: UserProfile;
  tasks: Task[];
  preferences: Preferences;
  taskTags: string[];
  lifeReflections: Record<string, ReflectionEntry>;
  lifeWins: Record<string, WeekWinEntry>;
  daySummaries: Record<string, DaySummary>;
  reminders: Reminder[];
  lifeGoals: LifeGoalNode[];
  lifeGoalLinks: LifeGoalLink[];
  lastNotificationSync?: string;
}
