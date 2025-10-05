import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState } from 'react';
import { createId } from '../utils/id';
import { loadAppState, persistAppState } from '../utils/storage';
const defaultState = {
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
function mergePreferences(preferences) {
    const { accentTheme = defaultState.preferences.accentTheme, surfaceTheme = defaultState.preferences.surfaceTheme, ...rest } = preferences ?? {};
    return {
        ...defaultState.preferences,
        ...rest,
        accentTheme,
        surfaceTheme
    };
}
function normalizeLifeReflections(entries) {
    const result = {};
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
function reducer(state, action) {
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
                tasks: state.tasks.map((task) => task.id === action.id ? { ...task, ...action.payload, updatedAt: new Date().toISOString() } : task)
            };
        case 'deleteTask':
            return { ...state, tasks: state.tasks.filter((task) => task.id !== action.id) };
        case 'setTaskStatus':
            return {
                ...state,
                tasks: state.tasks.map((task) => task.id === action.id ? { ...task, status: action.status, updatedAt: new Date().toISOString() } : task)
            };
        case 'setPreferences':
            return { ...state, preferences: { ...state.preferences, ...action.payload } };
        case 'setLifeReflection': {
            const next = { ...state.lifeReflections };
            if (action.reflection === 'none') {
                delete next[action.weekId];
            }
            else {
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
const AppDataContext = createContext(undefined);
export function AppDataProvider({ children }) {
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
    const setProfile = useCallback((profile) => {
        dispatch({ type: 'setProfile', payload: profile });
    }, []);
    const updateProfile = useCallback((updates) => {
        dispatch({ type: 'updateProfile', payload: updates });
    }, []);
    const addTask = useCallback((draft) => {
        const now = new Date().toISOString();
        const task = {
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
    const updateTask = useCallback((id, updates) => {
        dispatch({ type: 'updateTask', id, payload: updates });
    }, []);
    const deleteTask = useCallback((id) => {
        dispatch({ type: 'deleteTask', id });
    }, []);
    const setTaskStatus = useCallback((id, status) => {
        dispatch({ type: 'setTaskStatus', id, status });
    }, []);
    const setPreferences = useCallback((updates) => {
        dispatch({ type: 'setPreferences', payload: updates });
    }, []);
    const importState = useCallback((data) => {
        dispatch({ type: 'importState', payload: data });
    }, []);
    const setLifeReflection = useCallback((weekId, reflection, color) => {
        dispatch({ type: 'setLifeReflection', weekId, reflection, color });
    }, []);
    const setWeekWinManual = useCallback((weekId, fulfilled) => {
        dispatch({ type: 'setWeekWinManual', weekId, fulfilled });
    }, []);
    const resetWeekWin = useCallback((weekId) => {
        dispatch({ type: 'resetWeekWin', weekId });
    }, []);
    const value = useMemo(() => ({
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
            setLifeReflection,
            setWeekWinManual,
            resetWeekWin,
        }
    }), [
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
    ]);
    return _jsx(AppDataContext.Provider, { value: value, children: children });
}
export function useAppData() {
    const context = useContext(AppDataContext);
    if (!context) {
        throw new Error('useAppData must be used within AppDataProvider');
    }
    return context;
}
