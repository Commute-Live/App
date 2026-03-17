import React, {createContext, useContext, useMemo, useReducer} from 'react';
import type {CityId} from '../constants/cities';

type LayoutTheme = 'mono' | 'metro' | 'bold';
type Behavior = 'stationary' | 'scroll' | 'rotate';
type Density = 'large' | 'compact';
type DeviceStatus = 'unknown' | 'notPaired' | 'pairedOffline' | 'pairedOnline';

type Action =
  | {type: 'addStation'; station: string}
  | {type: 'removeStation'; station: string}
  | {type: 'setSelectedStations'; stations: string[]}
  | {type: 'setArrivals'; arrivals: {line: string; destination: string; minutes: number}[]}
  | {type: 'setTheme'; theme: LayoutTheme}
  | {type: 'setBehavior'; behavior: Behavior}
  | {type: 'setDensity'; density: Density}
  | {type: 'setPreset'; preset: string}
  | {type: 'applyPreset'; preset: Preset}
  | {type: 'setBrightness'; value: number}
  | {type: 'toggleAutoDim'; value: boolean}
  | {type: 'setDeviceStatus'; status: DeviceStatus}
  | {type: 'setSelectedCity'; city: CityId}
  | {type: 'setDeviceId'; deviceId: string | null}
  | {type: 'setUserId'; userId: string | null}
  | {type: 'clearAuth'};

export interface Preset {
  name: string;
  description: string;
  theme: LayoutTheme;
  behavior: Behavior;
  density: Density;
  brightness: number;
}

interface AppState {
  selectedStations: string[];
  theme: LayoutTheme;
  behavior: Behavior;
  density: Density;
  preset: string;
  brightness: number;
  autoDim: boolean;
  arrivals: {line: string; destination: string; minutes: number}[];
  deviceStatus: DeviceStatus;
  selectedCity: CityId;
  deviceId: string | null;
  userId: string | null;
}

const defaultArrivals: {line: string; destination: string; minutes: number}[] = [];

const initialState: AppState = {
  selectedStations: [],
  theme: 'mono',
  behavior: 'stationary',
  density: 'large',
  preset: 'Default Display',
  brightness: 70,
  autoDim: true,
  arrivals: defaultArrivals,
  deviceStatus: 'unknown',
  selectedCity: 'new-york',
  deviceId: null,
  userId: null,
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'addStation':
      if (state.selectedStations.includes(action.station)) return state;
      return {...state, selectedStations: [...state.selectedStations, action.station]};
    case 'removeStation':
      return {...state, selectedStations: state.selectedStations.filter(s => s !== action.station)};
    case 'setSelectedStations':
      return {...state, selectedStations: [...new Set(action.stations.map(station => station.trim()).filter(Boolean))]};
    case 'setArrivals':
      return {
        ...state,
        arrivals: action.arrivals
          .map(arrival => ({
            line: arrival.line.trim(),
            destination: arrival.destination.trim(),
            minutes: Math.max(0, Math.round(arrival.minutes)),
          }))
          .filter(arrival => arrival.line.length > 0),
      };
    case 'setTheme':
      return {...state, theme: action.theme};
    case 'setBehavior':
      return {...state, behavior: action.behavior};
    case 'setDensity':
      return {...state, density: action.density};
    case 'setPreset':
      return {...state, preset: action.preset};
    case 'applyPreset':
      return {
        ...state,
        preset: action.preset.name,
        theme: action.preset.theme,
        behavior: action.preset.behavior,
        density: action.preset.density,
        brightness: action.preset.brightness,
      };
    case 'setBrightness':
      return {...state, brightness: Math.max(0, Math.min(100, Math.round(action.value)))};
    case 'toggleAutoDim':
      return {...state, autoDim: action.value};
    case 'setDeviceStatus':
      return {...state, deviceStatus: action.status};
    case 'setSelectedCity':
      return {...state, selectedCity: action.city};
    case 'setDeviceId':
      return {...state, deviceId: action.deviceId};
    case 'setUserId':
      return {...state, userId: action.userId};
    case 'clearAuth':
      return {...state, userId: null, deviceId: null, deviceStatus: 'unknown'};
    default:
      return state;
  }
}

const AppStateContext = createContext<{
  state: AppState;
  addStation: (station: string) => void;
  removeStation: (station: string) => void;
  setSelectedStations: (stations: string[]) => void;
  setArrivals: (arrivals: {line: string; destination: string; minutes: number}[]) => void;
  setTheme: (theme: LayoutTheme) => void;
  setBehavior: (behavior: Behavior) => void;
  setDensity: (density: Density) => void;
  setPreset: (preset: string) => void;
  applyPreset: (preset: Preset) => void;
  setBrightness: (value: number) => void;
  toggleAutoDim: (value: boolean) => void;
  setDeviceStatus: (status: DeviceStatus) => void;
  setSelectedCity: (city: CityId) => void;
  setDeviceId: (deviceId: string | null) => void;
  setUserId: (userId: string | null) => void;
  clearAuth: () => void;
} | null>(null);

export const AppStateProvider = ({children}: {children: React.ReactNode}) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  const actions = useMemo(
    () => ({
      addStation: (station: string) => dispatch({type: 'addStation', station}),
      removeStation: (station: string) => dispatch({type: 'removeStation', station}),
      setSelectedStations: (stations: string[]) => dispatch({type: 'setSelectedStations', stations}),
      setArrivals: (arrivals: {line: string; destination: string; minutes: number}[]) =>
        dispatch({type: 'setArrivals', arrivals}),
      setTheme: (theme: LayoutTheme) => dispatch({type: 'setTheme', theme}),
      setBehavior: (behavior: Behavior) => dispatch({type: 'setBehavior', behavior}),
      setDensity: (density: Density) => dispatch({type: 'setDensity', density}),
      setPreset: (preset: string) => dispatch({type: 'setPreset', preset}),
      applyPreset: (preset: Preset) => dispatch({type: 'applyPreset', preset}),
      setBrightness: (value: number) => dispatch({type: 'setBrightness', value}),
      toggleAutoDim: (value: boolean) => dispatch({type: 'toggleAutoDim', value}),
      setDeviceStatus: (status: DeviceStatus) => dispatch({type: 'setDeviceStatus', status}),
      setSelectedCity: (city: CityId) => dispatch({type: 'setSelectedCity', city}),
      setDeviceId: (deviceId: string | null) => dispatch({type: 'setDeviceId', deviceId}),
      setUserId: (userId: string | null) => dispatch({type: 'setUserId', userId}),
      clearAuth: () => dispatch({type: 'clearAuth'}),
    }),
    [],
  );

  const value = useMemo(() => ({state, ...actions}), [state, actions]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
};

export const useAppState = () => {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider');
  return ctx;
};
