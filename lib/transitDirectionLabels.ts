export type UiDirection = 'uptown' | 'downtown';

type DirectionLabelVariant = 'toggle' | 'bound';

type DirectionCopy = {
  uptown: {
    toggle: string;
    bound: string;
  };
  downtown: {
    toggle: string;
    bound: string;
  };
};

const CTA_TRAIN_DIRECTION_COPY: Record<string, DirectionCopy> = {
  BLUE: {
    uptown: {toggle: "O'Hare", bound: "O'Hare-bound"},
    downtown: {toggle: 'Forest Park', bound: 'Forest Park-bound'},
  },
  RED: {
    uptown: {toggle: 'Howard', bound: 'Howard-bound'},
    downtown: {toggle: '95th', bound: '95th-bound'},
  },
  BRN: {
    uptown: {toggle: 'Kimball', bound: 'Kimball-bound'},
    downtown: {toggle: 'Loop', bound: 'Loop-bound'},
  },
  G: {
    uptown: {toggle: 'Harlem/Lake', bound: 'Harlem/Lake-bound'},
    downtown: {
      toggle: 'Ashland/63rd or Cottage Grove',
      bound: 'Ashland/63rd or Cottage Grove',
    },
  },
  ORG: {
    uptown: {toggle: 'Loop', bound: 'Loop-bound'},
    downtown: {toggle: 'Midway', bound: 'Midway-bound'},
  },
  P: {
    uptown: {toggle: 'Linden', bound: 'Linden-bound'},
    downtown: {toggle: 'Loop', bound: 'Loop-bound'},
  },
  PINK: {
    uptown: {toggle: 'Loop', bound: 'Loop-bound'},
    downtown: {toggle: '54th/Cermak', bound: '54th/Cermak-bound'},
  },
  Y: {
    uptown: {toggle: 'Skokie', bound: 'Skokie-bound'},
    downtown: {toggle: 'Howard', bound: 'Howard-bound'},
  },
};

const normalizeRouteId = (value: string | null | undefined) => value?.trim().toUpperCase() ?? '';

export const getChicagoTrainDirectionLabel = (
  routeId: string | null | undefined,
  direction: UiDirection,
  variant: DirectionLabelVariant = 'bound',
): string | null => {
  const copy = CTA_TRAIN_DIRECTION_COPY[normalizeRouteId(routeId)];
  if (!copy) return null;
  return copy[direction][variant];
};

