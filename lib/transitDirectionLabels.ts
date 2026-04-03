import type {DirectionVariant, UiDirection} from './transit/frontendTypes';
import {getChicagoDirectionLabel} from './transit/providers/chicago';

export type {UiDirection};

export const getChicagoTrainDirectionLabel = (
  routeId: string | null | undefined,
  direction: UiDirection,
  variant: DirectionVariant = 'bound',
): string | null => getChicagoDirectionLabel('train', direction, routeId, variant);
