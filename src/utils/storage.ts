import { get, set } from 'idb-keyval';
import { z } from 'zod';
import type {
  AccentTheme,
  AppState,
  DaySummary,
  Preferences,
  ReflectionEntry,
  ReflectionTag,
  SurfaceTheme,
  Task,
  TaskStatus,
  UserProfile,
  WeekWinEntry
} from '../types';

const IDB_KEY = 'lifepace/app-state';
const LOCAL_CACHE_KEY = 'lifepace-cache-v1';

const taskStatusSchema = z.union([
  z.literal('planned'),
  z.literal('in_progress'),
  z.literal('completed'),
  z.literal('skipped')
]);

const taskSchema: z.ZodType<Task> = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  scheduledFor: z.string(),
  startAt: z.string().optional(),
  deadlineAt: z.string().optional(),
  reminderAt: z.string().optional(),
  status: taskStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string()
});

const profileSchema: z.ZodType<UserProfile> = z.object({
  name: z.string().min(1),
  dateOfBirth: z.string(),
  lifeExpectancyYears: z.number().min(1).max(120),
  dayStartHour: z.number().min(0).max(23),
  dayEndHour: z.number().min(1).max(24),
  allowNotifications: z.boolean(),
  onboardingComplete: z.boolean()
});

const accentThemeSchema: z.ZodType<AccentTheme> = z.union([
  z.literal('aurora'),
  z.literal('forest'),
  z.literal('sunset'),
  z.literal('midnight')
]);

const surfaceThemeSchema: z.ZodType<SurfaceTheme> = z.union([
  z.literal('indigo'),
  z.literal('midnight'),
  z.literal('slate'),
  z.literal('charcoal')
]);

const preferencesSchema: z.ZodType<Preferences> = z.object({
  reminderLeadMinutes: z.number().min(0).max(720),
  defaultReminderTime: z.string().optional(),
  accentTheme: accentThemeSchema.default('aurora'),
  surfaceTheme: surfaceThemeSchema.default('indigo'),
  dayFulfillmentThreshold: z.number().min(10).max(100).default(40),
  weekFulfillmentTarget: z.number().min(1).max(7).default(3)
});

const reflectionTagSchema = z.union([
  z.literal('none'),
  z.literal('learned'),
  z.literal('progressed'),
  z.literal('advanced'),
  z.literal('enjoyed')
]);

const reflectionEntrySchema = z.object({
  tag: reflectionTagSchema,
  color: z.string().optional()
});

const rawLifeReflectionSchema = z
  .record(z.union([reflectionEntrySchema, reflectionTagSchema]))
  .default({});

const weekWinEntrySchema = z.object({
  status: z.union([z.literal('auto'), z.literal('manual')]).default('auto'),
  fulfilled: z.boolean()
});

const rawLifeWinsSchema = z
  .record(z.union([weekWinEntrySchema, z.boolean()]))
  .default({});

const daySummarySchema: z.ZodType<DaySummary> = z.object({
  date: z.string(),
  completionRate: z.number(),
  totalTasks: z.number(),
  completedTasks: z.number(),
  weekId: z.string(),
  fulfilled: z.boolean()
});

const daySummariesSchema = z.record(daySummarySchema).default({});

const appStateSchema = z.object({
  profile: profileSchema.optional(),
  tasks: z.array(taskSchema),
  preferences: preferencesSchema,
  lifeReflections: rawLifeReflectionSchema,
  lifeWins: rawLifeWinsSchema.optional(),
  daySummaries: daySummariesSchema.optional(),
  lastNotificationSync: z.string().optional()
});

function normalizeLifeReflections(
  raw: Record<string, ReflectionTag | ReflectionEntry> | undefined
): Record<string, ReflectionEntry> {
  const normalized: Record<string, ReflectionEntry> = {};
  if (!raw) {
    return normalized;
  }
  Object.entries(raw).forEach(([id, value]) => {
    if (!value) {
      return;
    }
    if (typeof value === 'string') {
      if (value !== 'none') {
        normalized[id] = { tag: value };
      }
    } else if (value.tag && value.tag !== 'none') {
      normalized[id] = { tag: value.tag, color: value.color };
    }
  });
  return normalized;
}

function normalizeLifeWins(
  raw: Record<string, boolean | WeekWinEntry> | undefined
): Record<string, WeekWinEntry> {
  const normalized: Record<string, WeekWinEntry> = {};
  if (!raw) {
    return normalized;
  }
  Object.entries(raw).forEach(([id, value]) => {
    if (typeof value === 'boolean') {
      if (value) {
        normalized[id] = { status: 'auto', fulfilled: true };
      }
    } else if (value && value.fulfilled) {
      normalized[id] = {
        status: value.status ?? 'auto',
        fulfilled: value.fulfilled
      };
    } else if (value) {
      normalized[id] = {
        status: value.status ?? 'manual',
        fulfilled: value.fulfilled
      };
    }
  });
  return normalized;
}

function normalizeDaySummaries(raw: Record<string, DaySummary> | undefined): Record<string, DaySummary> {
  if (!raw) {
    return {};
  }
  const normalized: Record<string, DaySummary> = {};
  Object.entries(raw).forEach(([date, summary]) => {
    if (!summary) {
      return;
    }
    normalized[date] = summary;
  });
  return normalized;
}

function normalizePreferences(preferences?: Preferences): Preferences {
  const {
    accentTheme = 'aurora',
    surfaceTheme = 'indigo',
    dayFulfillmentThreshold = 40,
    weekFulfillmentTarget = 3,
    reminderLeadMinutes = 15,
    defaultReminderTime
  } = preferences ?? {};
  return {
    reminderLeadMinutes,
    defaultReminderTime,
    accentTheme,
    surfaceTheme,
    dayFulfillmentThreshold,
    weekFulfillmentTarget
  };
}

function normalizeAppState(state: z.infer<typeof appStateSchema>): AppState {
  return {
    profile: state.profile,
    tasks: state.tasks,
    preferences: normalizePreferences(state.preferences),
    lifeReflections: normalizeLifeReflections(state.lifeReflections),
    lifeWins: normalizeLifeWins(state.lifeWins),
    daySummaries: normalizeDaySummaries(state.daySummaries),
    lastNotificationSync: state.lastNotificationSync
  };
}

export async function loadAppState(): Promise<AppState | undefined> {
  const parse = (raw: unknown) => {
    const result = appStateSchema.safeParse(raw);
    if (!result.success) {
      return undefined;
    }
    return normalizeAppState(result.data);
  };

  try {
    const cached = localStorage.getItem(LOCAL_CACHE_KEY);
    if (cached) {
      const parsed = parse(JSON.parse(cached));
      if (parsed) {
        return parsed;
      }
    }
  } catch (error) {
    console.warn('Failed to read cached state', error);
  }

  try {
    const stored = await get<AppState>(IDB_KEY);
    if (stored) {
      const parsed = parse(stored);
      if (parsed) {
        localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(parsed));
        return parsed;
      }
    }
  } catch (error) {
    console.warn('Failed to load state from IndexedDB', error);
  }

  return undefined;
}

export async function persistAppState(state: AppState): Promise<void> {
  try {
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('Failed to save cache to local storage', error);
  }

  try {
    await set(IDB_KEY, state);
  } catch (error) {
    console.warn('Failed to save state to IndexedDB', error);
  }
}

export function createExportPayload(state: AppState): string {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    state
  };
  return JSON.stringify(payload, null, 2);
}

const importSchema = z.object({
  version: z.number().min(1),
  exportedAt: z.string(),
  state: appStateSchema
});

export function parseImportedPayload(raw: string): AppState {
  const result = importSchema.safeParse(JSON.parse(raw));
  if (!result.success) {
    throw new Error('Invalid import file');
  }
  return normalizeAppState(result.data.state);
}

