import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState } from 'react';
import type {
  AppState,
  Preferences,
  Task,
  TaskStatus,
  UserProfile,
  ReflectionTag,
  ReflectionEntry,
  WeekWinEntry,
  Reminder,
  LifeGoalNode,
  LifeGoalLink
} from '../types';
import { createId } from '../utils/id';
import { loadAppState, persistAppState } from '../utils/storage';
import { computeDaySummaries, deriveAutoWeekWins } from '../utils/metrics';

interface TaskDraft {
  title: string;
  description?: string;
  scheduledFor: string;
  startAt?: string;
  deadlineAt?: string;
  reminderAt?: string;
  durationMinutes?: number;
  progressive?: boolean;
  tags?: string[];
}

interface ReminderDraft {
  title: string;
  description?: string;
  schedule: Reminder['schedule'];
}

interface LifeGoalDraft {
  id?: string;
  title: string;
  description?: string;
  position?: { x: number; y: number };
}

interface AppDataValue {
  state: AppState;
  loading: boolean;
  actions: {
    setProfile: (profile: UserProfile) => void;
    updateProfile: (updates: Partial<UserProfile>) => void;
    addTask: (draft: TaskDraft) => void;
    updateTask: (id: string, updates: Partial<Omit<Task, 'id'>>) => void;
    deleteTask: (id: string) => void;
    setTaskStatus: (id: string, status: TaskStatus) => void;
    setPreferences: (updates: Partial<Preferences>) => void;
    addTaskTag: (tag: string) => void;
    removeTaskTag: (tag: string) => void;
    importState: (state: AppState) => void;
    setLifeReflection: (weekId: string, reflection: ReflectionTag, color?: string) => void;
    setWeekWinManual: (weekId: string, fulfilled: boolean) => void;
    resetWeekWin: (weekId: string) => void;
    addReminder: (draft: ReminderDraft) => void;
    updateReminder: (id: string, updates: Partial<Omit<Reminder, 'id'>>) => void;
    deleteReminder: (id: string) => void;
    addLifeGoal: (draft: LifeGoalDraft) => void;
    updateLifeGoal: (id: string, updates: Partial<Omit<LifeGoalNode, 'id'>>) => void;
    deleteLifeGoal: (id: string) => void;
    connectLifeGoals: (sourceId: string, targetId: string) => void;
    disconnectLifeGoals: (linkId: string) => void;
  };
  autoWeekWins: Set<string>;
}

type AppAction =
  | { type: 'hydrate'; payload: AppState }
  | { type: 'setProfile'; payload: UserProfile }
  | { type: 'updateProfile'; payload: Partial<UserProfile> }
  | { type: 'addTask'; payload: Task }
  | { type: 'updateTask'; id: string; payload: Partial<Omit<Task, 'id'>> }
  | { type: 'deleteTask'; id: string }
  | { type: 'setTaskStatus'; id: string; status: TaskStatus }
  | { type: 'setPreferences'; payload: Partial<Preferences> }
  | { type: 'addTaskTag'; tag: string }
  | { type: 'removeTaskTag'; tag: string }
  | { type: 'importState'; payload: AppState }
  | { type: 'setLifeReflection'; weekId: string; reflection: ReflectionTag; color?: string }
  | { type: 'setWeekWinManual'; weekId: string; fulfilled: boolean }
  | { type: 'resetWeekWin'; weekId: string }
  | { type: 'addReminder'; payload: Reminder }
  | { type: 'updateReminder'; id: string; payload: Partial<Omit<Reminder, 'id'>> }
  | { type: 'deleteReminder'; id: string }
  | { type: 'addLifeGoal'; payload: LifeGoalNode }
  | { type: 'updateLifeGoal'; id: string; payload: Partial<Omit<LifeGoalNode, 'id'>> }
  | { type: 'deleteLifeGoal'; id: string }
  | { type: 'connectLifeGoals'; payload: LifeGoalLink }
  | { type: 'disconnectLifeGoals'; id: string };

const defaultState: AppState = {
  tasks: [],
  preferences: {
    reminderLeadMinutes: 15,
    defaultReminderTime: '09:00',
    accentTheme: 'aurora',
    surfaceTheme: 'indigo',
    dayFulfillmentThreshold: 40,
    weekFulfillmentTarget: 3,
    progressiveTasksPerDay: 1,
    progressiveDaysForWeekWin: 3,
    showLifeCalendar: true
  },
  taskTags: [],
  lifeReflections: {},
  lifeWins: {},
  daySummaries: {},
  reminders: [],
  lifeGoals: [],
  lifeGoalLinks: []
};

function mergePreferences(preferences?: Preferences): Preferences {
  const {
    accentTheme = defaultState.preferences.accentTheme,
    surfaceTheme = defaultState.preferences.surfaceTheme,
    progressiveTasksPerDay = defaultState.preferences.progressiveTasksPerDay,
    progressiveDaysForWeekWin = defaultState.preferences.progressiveDaysForWeekWin,
    showLifeCalendar = defaultState.preferences.showLifeCalendar,
    ...rest
  } = preferences ?? {};
  return {
    ...defaultState.preferences,
    ...rest,
    accentTheme,
    surfaceTheme,
    progressiveTasksPerDay,
    progressiveDaysForWeekWin,
    showLifeCalendar
  };
}

function normalizeLifeReflections(entries?: Record<string, ReflectionEntry | ReflectionTag>): Record<string, ReflectionEntry> {
  const result: Record<string, ReflectionEntry> = {};
  if (!entries) {
    return result;
  }
  Object.entries(entries).forEach(([id, entry]) => {
    if (!entry) {
      return;
    }
    const tag = typeof entry === 'string' ? entry : entry.tag;
    if (!tag || tag === 'none') {
      return;
    }
    const color = typeof entry === 'string' ? undefined : entry.color;
    result[id] = { tag, color };
  });
  return result;
}

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'hydrate':
      return {
        ...defaultState,
        ...action.payload,
        preferences: mergePreferences(action.payload.preferences),
        lifeReflections: normalizeLifeReflections(action.payload.lifeReflections)
      };
    case 'importState':
      return {
        ...defaultState,
        ...action.payload,
        preferences: mergePreferences(action.payload.preferences),
        lifeReflections: normalizeLifeReflections(action.payload.lifeReflections)
      };
    case 'setProfile':
      return { ...state, profile: action.payload };
    case 'updateProfile':
      return state.profile
        ? { ...state, profile: { ...state.profile, ...action.payload } }
        : state;
    case 'addTask':
      return { ...state, tasks: [...state.tasks, action.payload] };
    case 'updateTask':
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.id ? { ...task, ...action.payload, updatedAt: new Date().toISOString() } : task
        )
      };
    case 'deleteTask':
      return { ...state, tasks: state.tasks.filter((task) => task.id !== action.id) };
    case 'setTaskStatus':
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.id ? { ...task, status: action.status, updatedAt: new Date().toISOString() } : task
        )
      };
    case 'addTaskTag': {
      const tag = action.tag.trim();
      if (!tag) {
        return state;
      }
      if (state.taskTags.includes(tag)) {
        return state;
      }
      return { ...state, taskTags: [...state.taskTags, tag].sort((a, b) => a.localeCompare(b)) };
    }
    case 'removeTaskTag': {
      const nextTags = state.taskTags.filter((tag) => tag !== action.tag);
      if (nextTags.length === state.taskTags.length) {
        return state;
      }
      const nextTasks = state.tasks.map((task) =>
        task.tags.includes(action.tag)
          ? { ...task, tags: task.tags.filter((tag) => tag !== action.tag) }
          : task
      );
      return { ...state, taskTags: nextTags, tasks: nextTasks };
    }
    case 'setPreferences':
      return { ...state, preferences: { ...state.preferences, ...action.payload } };
    case 'setLifeReflection': {
      const next = { ...state.lifeReflections } as Record<string, ReflectionEntry>;
      if (action.reflection === 'none') {
        delete next[action.weekId];
      } else {
        next[action.weekId] = {
          tag: action.reflection,
          color: action.color
        };
      }
      return { ...state, lifeReflections: next };
    }
    case 'setWeekWinManual': {
      const next = { ...state.lifeWins } as Record<string, WeekWinEntry>;
      next[action.weekId] = {
        status: 'manual',
        fulfilled: action.fulfilled
      };
      return { ...state, lifeWins: next };
    }
    case 'resetWeekWin': {
      const next = { ...state.lifeWins } as Record<string, WeekWinEntry>;
      delete next[action.weekId];
      return { ...state, lifeWins: next };
    }
    case 'addReminder':
      return { ...state, reminders: [...state.reminders, action.payload] };
    case 'updateReminder':
      return {
        ...state,
        reminders: state.reminders.map((reminder) =>
          reminder.id === action.id
            ? { ...reminder, ...action.payload, updatedAt: new Date().toISOString() }
            : reminder
        )
      };
    case 'deleteReminder':
      return { ...state, reminders: state.reminders.filter((reminder) => reminder.id !== action.id) };
    case 'addLifeGoal':
      return { ...state, lifeGoals: [...state.lifeGoals, action.payload] };
    case 'updateLifeGoal':
      return {
        ...state,
        lifeGoals: state.lifeGoals.map((goal) =>
          goal.id === action.id ? { ...goal, ...action.payload } : goal
        )
      };
    case 'deleteLifeGoal':
      return {
        ...state,
        lifeGoals: state.lifeGoals.filter((goal) => goal.id !== action.id),
        lifeGoalLinks: state.lifeGoalLinks.filter(
          (link) => link.sourceId !== action.id && link.targetId !== action.id
        )
      };
    case 'connectLifeGoals':
      return {
        ...state,
        lifeGoalLinks: [...state.lifeGoalLinks, action.payload]
      };
    case 'disconnectLifeGoals':
      return {
        ...state,
        lifeGoalLinks: state.lifeGoalLinks.filter((link) => link.id !== action.id)
      };
    default:
      return state;
  }
}

const AppDataContext = createContext<AppDataValue | undefined>(undefined);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, defaultState);
  const [loading, setLoading] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;
    loadAppState().then((loaded) => {
      if (mounted && loaded) {
        dispatch({ type: 'hydrate', payload: loaded });
      }
      if (mounted) {
        setLoading(false);
        setHydrated(true);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    persistAppState(state);
  }, [state, hydrated]);

  const setProfile = useCallback((profile: UserProfile) => {
    dispatch({ type: 'setProfile', payload: profile });
  }, []);

  const updateProfile = useCallback((updates: Partial<UserProfile>) => {
    dispatch({ type: 'updateProfile', payload: updates });
  }, []);

  const addTask = useCallback((draft: TaskDraft) => {
    const now = new Date().toISOString();
    const task: Task = {
      id: createId(),
      title: draft.title,
      description: draft.description,
      scheduledFor: draft.scheduledFor,
      startAt: draft.startAt,
      deadlineAt: draft.deadlineAt,
      reminderAt: draft.reminderAt,
      durationMinutes: draft.durationMinutes,
      progressive: draft.progressive ?? true,
      tags: draft.tags ?? [],
      status: 'planned',
      createdAt: now,
      updatedAt: now
    };
    dispatch({ type: 'addTask', payload: task });
  }, []);

  const updateTask = useCallback((id: string, updates: Partial<Omit<Task, 'id'>>) => {
    dispatch({ type: 'updateTask', id, payload: updates });
  }, []);

  const deleteTask = useCallback((id: string) => {
    dispatch({ type: 'deleteTask', id });
  }, []);

  const setTaskStatus = useCallback((id: string, status: TaskStatus) => {
    dispatch({ type: 'setTaskStatus', id, status });
  }, []);

  const setPreferences = useCallback((updates: Partial<Preferences>) => {
    dispatch({ type: 'setPreferences', payload: updates });
  }, []);

  const addTaskTag = useCallback((tag: string) => {
    dispatch({ type: 'addTaskTag', tag });
  }, []);

  const removeTaskTag = useCallback((tag: string) => {
    dispatch({ type: 'removeTaskTag', tag });
  }, []);

  const importState = useCallback((data: AppState) => {
    dispatch({ type: 'importState', payload: data });
  }, []);

  const setLifeReflection = useCallback((weekId: string, reflection: ReflectionTag, color?: string) => {
    dispatch({ type: 'setLifeReflection', weekId, reflection, color });
  }, []);

  const setWeekWinManual = useCallback((weekId: string, fulfilled: boolean) => {
    dispatch({ type: 'setWeekWinManual', weekId, fulfilled });
  }, []);

  const resetWeekWin = useCallback((weekId: string) => {
    dispatch({ type: 'resetWeekWin', weekId });
  }, []);

  const addReminder = useCallback((draft: ReminderDraft) => {
    const now = new Date().toISOString();
    const reminder: Reminder = {
      id: createId(),
      title: draft.title,
      description: draft.description,
      schedule: draft.schedule,
      createdAt: now,
      updatedAt: now
    };
    dispatch({ type: 'addReminder', payload: reminder });
  }, []);

  const updateReminder = useCallback((id: string, updates: Partial<Omit<Reminder, 'id'>>) => {
    dispatch({ type: 'updateReminder', id, payload: updates });
  }, []);

  const deleteReminder = useCallback((id: string) => {
    dispatch({ type: 'deleteReminder', id });
  }, []);

  const addLifeGoal = useCallback((draft: LifeGoalDraft) => {
    const goal: LifeGoalNode = {
      id: draft.id ?? createId(),
      title: draft.title,
      description: draft.description,
      x: draft.position?.x ?? 0,
      y: draft.position?.y ?? 0
    };
    dispatch({ type: 'addLifeGoal', payload: goal });
  }, []);

  const updateLifeGoal = useCallback((id: string, updates: Partial<Omit<LifeGoalNode, 'id'>>) => {
    dispatch({ type: 'updateLifeGoal', id, payload: updates });
  }, []);

  const deleteLifeGoal = useCallback((id: string) => {
    dispatch({ type: 'deleteLifeGoal', id });
  }, []);

  const connectLifeGoals = useCallback((sourceId: string, targetId: string) => {
    const link: LifeGoalLink = {
      id: createId(),
      sourceId,
      targetId
    };
    dispatch({ type: 'connectLifeGoals', payload: link });
  }, []);

  const disconnectLifeGoals = useCallback((linkId: string) => {
    dispatch({ type: 'disconnectLifeGoals', id: linkId });
  }, []);

  const derivedDaySummaries = useMemo(() => {
    if (!state.profile) {
      return {};
    }
    return computeDaySummaries(state.tasks, state.preferences, state.profile);
  }, [state.tasks, state.preferences, state.profile]);

  const autoWeekWins = useMemo(() => {
    return deriveAutoWeekWins(derivedDaySummaries, state.preferences.progressiveDaysForWeekWin ?? 3);
  }, [derivedDaySummaries, state.preferences.progressiveDaysForWeekWin]);

  const combinedLifeWins = useMemo(() => {
    const manual = state.lifeWins ?? {};
    const merged: Record<string, WeekWinEntry> = { ...manual };
    autoWeekWins.forEach((weekId) => {
      const existing = merged[weekId];
      if (existing && existing.status === 'manual') {
        return;
      }
      merged[weekId] = { status: 'auto', fulfilled: true };
    });
    return merged;
  }, [state.lifeWins, autoWeekWins]);

  const value = useMemo<AppDataValue>(
    () => ({
      state: {
        ...state,
        daySummaries: derivedDaySummaries,
        lifeWins: combinedLifeWins
      },
      loading,
      autoWeekWins,
      actions: {
        setProfile,
        updateProfile,
        addTask,
        updateTask,
        deleteTask,
        setTaskStatus,
        setPreferences,
        addTaskTag,
        removeTaskTag,
        importState,
        setLifeReflection,
        setWeekWinManual,
        resetWeekWin,
        addReminder,
        updateReminder,
        deleteReminder,
        addLifeGoal,
        updateLifeGoal,
        deleteLifeGoal,
        connectLifeGoals,
        disconnectLifeGoals
      }
    }),
    [
      state,
      derivedDaySummaries,
      combinedLifeWins,
      autoWeekWins,
      loading,
      setProfile,
      updateProfile,
      addTask,
      updateTask,
      deleteTask,
      setTaskStatus,
      setPreferences,
      addTaskTag,
      removeTaskTag,
      importState,
      setLifeReflection,
      setWeekWinManual,
      resetWeekWin,
      addReminder,
      updateReminder,
      deleteReminder,
      addLifeGoal,
      updateLifeGoal,
      deleteLifeGoal,
      connectLifeGoals,
      disconnectLifeGoals
    ]
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataValue {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error('useAppData must be used within AppDataProvider');
  }
  return context;
}
