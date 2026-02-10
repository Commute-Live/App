import React, {createContext, useContext, useMemo, useReducer} from 'react';

type LayoutTheme = 'mono' | 'metro' | 'bold';
type Behavior = 'stationary' | 'scroll' | 'rotate';
type Density = 'large' | 'compact';
type DeviceStatus = 'unknown' | 'notPaired' | 'pairedOffline' | 'pairedOnline';

type Action =
  | {type: 'addStation'; station: string}
  | {type: 'removeStation'; station: string}
  | {type: 'setTheme'; theme: LayoutTheme}
  | {type: 'setBehavior'; behavior: Behavior}
  | {type: 'setDensity'; density: Density}
  | {type: 'setPreset'; preset: string}
  | {type: 'applyPreset'; preset: Preset}
  | {type: 'setBrightness'; value: number}
  | {type: 'toggleAutoDim'; value: boolean}
  | {type: 'setDeviceStatus'; status: DeviceStatus}
  | {type: 'setDeviceId'; deviceId: string | null}
  | {type: 'setUserId'; userId: string | null};

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
  deviceId: string | null;
  userId: string | null;
}

const defaultArrivals = [
  {line: 'Link', destination: 'Capitol Hill', minutes: 3},
  {line: 'RapidRide E', destination: 'Aurora Village', minutes: 7},
  {line: 'Route 62', destination: 'Sand Point', minutes: 12},
];

const initialState: AppState = {
  selectedStations: ['Westlake Station', 'South Lake Union'],
  theme: 'mono',
  behavior: 'stationary',
  density: 'large',
  preset: 'Morning Commute',
  brightness: 70,
  autoDim: true,
  arrivals: defaultArrivals,
  deviceStatus: 'unknown',
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
    case 'setDeviceId':
      return {...state, deviceId: action.deviceId};
    case 'setUserId':
      return {...state, userId: action.userId};
    default:
      return state;
  }
}

const AppStateContext = createContext<{
  state: AppState;
  addStation: (station: string) => void;
  removeStation: (station: string) => void;
  setTheme: (theme: LayoutTheme) => void;
  setBehavior: (behavior: Behavior) => void;
  setDensity: (density: Density) => void;
  setPreset: (preset: string) => void;
  applyPreset: (preset: Preset) => void;
  setBrightness: (value: number) => void;
  toggleAutoDim: (value: boolean) => void;
  setDeviceStatus: (status: DeviceStatus) => void;
  setDeviceId: (deviceId: string | null) => void;
  setUserId: (userId: string | null) => void;
} | null>(null);

export const AppStateProvider = ({children}: {children: React.ReactNode}) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  const actions = useMemo(
    () => ({
      addStation: (station: string) => dispatch({type: 'addStation', station}),
      removeStation: (station: string) => dispatch({type: 'removeStation', station}),
      setTheme: (theme: LayoutTheme) => dispatch({type: 'setTheme', theme}),
      setBehavior: (behavior: Behavior) => dispatch({type: 'setBehavior', behavior}),
      setDensity: (density: Density) => dispatch({type: 'setDensity', density}),
      setPreset: (preset: string) => dispatch({type: 'setPreset', preset}),
      applyPreset: (preset: Preset) => dispatch({type: 'applyPreset', preset}),
      setBrightness: (value: number) => dispatch({type: 'setBrightness', value}),
      toggleAutoDim: (value: boolean) => dispatch({type: 'toggleAutoDim', value}),
      setDeviceStatus: (status: DeviceStatus) => dispatch({type: 'setDeviceStatus', status}),
      setDeviceId: (deviceId: string | null) => dispatch({type: 'setDeviceId', deviceId}),
      setUserId: (userId: string | null) => dispatch({type: 'setUserId', userId}),
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
