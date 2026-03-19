export const extractConfigDisplayId = (payload: unknown): string | null => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;

  const data = payload as {
    displayId?: unknown;
    activeDisplayId?: unknown;
    display?: {displayId?: unknown} | null;
  };

  if (typeof data.displayId === 'string' && data.displayId.trim().length > 0) {
    return data.displayId.trim();
  }

  if (typeof data.activeDisplayId === 'string' && data.activeDisplayId.trim().length > 0) {
    return data.activeDisplayId.trim();
  }

  if (typeof data.display?.displayId === 'string' && data.display.displayId.trim().length > 0) {
    return data.display.displayId.trim();
  }

  return null;
};
