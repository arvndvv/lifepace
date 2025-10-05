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
}

export interface ReflectionEntry {
  tag: ReflectionTag;
  color?: string;
}

export interface WeekWinEntry {
  status: 'auto' | 'manual';
  fulfilled: boolean;
}

export interface DaySummary {
  date: string;
  completionRate: number;
  totalTasks: number;
  completedTasks: number;
  weekId: string;
  fulfilled: boolean;
}

export interface AppState {
  profile?: UserProfile;
  tasks: Task[];
  preferences: Preferences;
  lifeReflections: Record<string, ReflectionEntry>;
  lifeWins: Record<string, WeekWinEntry>;
  daySummaries: Record<string, DaySummary>;
  lastNotificationSync?: string;
}
