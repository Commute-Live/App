import type {TransitLineDirection, TransitUiDirection, TransitUiMode} from '../../types/transit';

export type ModeId = TransitUiMode;
export type UiDirection = TransitUiDirection;
export type DirectionVariant = 'toggle' | 'bound' | 'summary';

const UI_DIRECTIONS: ReadonlySet<UiDirection> = new Set([
  'uptown',
  'downtown',
  'northbound',
  'southbound',
  'dir0',
  'dir1',
  'westbound',
  'eastbound',
  'outbound',
  'inbound',
]);

export const isUiDirection = (value: string): value is UiDirection =>
  UI_DIRECTIONS.has(value as UiDirection);

export type TransitRouteAppearance = {
  color: string;
  textColor: string;
};

export type TransitRouteRecord = {
  id: string;
  label: string;
  sortOrder: number | null;
  color: string;
  textColor?: string;
  headsign0: string | null;
  headsign1: string | null;
  directions: TransitLineDirection[];
};

export type TransitRoutePickerItem = {
  id: string;
  label: string;
  displayLabel: string;
  color: string;
  textColor?: string;
  routes: TransitRouteRecord[];
};

export type TransitRouteGroup = {
  key: string;
  title?: string;
  routes: TransitRoutePickerItem[];
};
