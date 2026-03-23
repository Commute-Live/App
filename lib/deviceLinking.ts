const DEVICE_LINK_OWNERSHIP_CONFLICT = 'device already linked to another user';

const DEVICE_LINK_OWNERSHIP_CONFLICT_MESSAGE =
  'This display is already linked to another CommuteLive account. Sign in with the original account or remove the display from that account before pairing it here.';

export const readApiError = (data: unknown) =>
  typeof (data as {error?: unknown})?.error === 'string'
    ? (data as {error: string}).error
    : null;

export const isDeviceLinkOwnershipConflict = (status: number, error: unknown) =>
  status === 409 && error === DEVICE_LINK_OWNERSHIP_CONFLICT;

export const isBenignDeviceLinkConflict = (status: number, error: unknown) =>
  status === 409 && !isDeviceLinkOwnershipConflict(status, error);

export const getDeviceLinkFailureMessage = (
  status: number,
  error: unknown,
  fallbackPrefix: string,
) => {
  if (isDeviceLinkOwnershipConflict(status, error)) {
    return DEVICE_LINK_OWNERSHIP_CONFLICT_MESSAGE;
  }

  if (typeof error === 'string' && error.length > 0) {
    return `${fallbackPrefix}: ${error}`;
  }

  return `${fallbackPrefix} (${status})`;
};
