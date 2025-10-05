import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState } from 'react';
import type {
  AppState,
  Preferences,
  Task,
  TaskStatus,
  UserProfile,
  ReflectionTag,
  ReflectionEntry,
  WeekWinEntry
} from '../types';
import { createId } from '../utils/id';
import { loadAppState, persistAppState } from '../utils/storage';
import { computeDaySummaries, deriveAutoWeekWins } from '../utils/metrics';

interface TaskDraft {
  title: string;
  description?: string;
  scheduledFor: string;
  startAt: string;
  deadlineAt?: string;
  reminderAt?: string;
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
    importState: (state: AppState) => void;
    setLifeReflection: (weekId: string, reflection: ReflectionTag, color?: string) => void;
    setWeekWinManual: (weekId: string, fulfilled: boolean) => void;
    resetWeekWin: (weekId: string) => void;
  };
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
  | { type: 'importState'; payload: AppState }
  | { type: 'setLifeReflection'; weekId: string; reflection: ReflectionTag; color?: string }
  | { type: 'setWeekWinManual'; weekId: string; fulfilled: boolean }
  | { type: 'resetWeekWin'; weekId: string };

const defaultState: AppState = {
  tasks: [],
  preferences: {
    reminderLeadMinutes: 15,
    defaultReminderTime: '09:00',
    accentTheme: 'aurora',
    surfaceTheme: 'indigo',
    dayFulfillmentThreshold: 40,
    weekFulfillmentTarget: 3
  },
  lifeReflections: {},
  lifeWins: {},
  daySummaries: {}
};

function mergePreferences(preferences?: Preferences): Preferences {
  const {
    accentTheme = defaultState.preferences.accentTheme,
    surfaceTheme = defaultState.preferences.surfaceTheme,
    ...rest
  } = preferences ?? {};
  return {
    ...defaultState.preferences,
    ...rest,
    accentTheme,
    surfaceTheme
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

  const importState = useCallback((data: AppState) => {
    dispatch({ type: 'importState', payload: data });
  }, []);

  const setLifeReflection = useCallback((weekId: string, reflection: ReflectionTag, color?: string) => {
    dispatch({ type: 'setLifeReflection', weekId, reflection, color });
  }, []);

  const value = useMemo<AppDataValue>(
    () => ({
      state,
      loading,
      actions: {
        setProfile,
        updateProfile,
        addTask,
        updateTask,
        deleteTask,
        setTaskStatus,
        setPreferences,
        importState,
        setLifeReflection
      }
    }),
    [
      state,
      loading,
      setProfile,
      updateProfile,
      addTask,
      updateTask,
      deleteTask,
      setTaskStatus,
      setPreferences,
      importState,
      setLifeReflection
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
