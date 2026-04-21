export const extractConfigPresetId = (payload: unknown): string | null => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;

  const data = payload as {
    presetId?: unknown;
    activePresetId?: unknown;
    preset?: {presetId?: unknown} | null;
  };

  if (typeof data.presetId === 'string' && data.presetId.trim().length > 0) {
    return data.presetId.trim();
  }

  if (typeof data.activePresetId === 'string' && data.activePresetId.trim().length > 0) {
    return data.activePresetId.trim();
  }

  if (typeof data.preset?.presetId === 'string' && data.preset.presetId.trim().length > 0) {
    return data.preset.presetId.trim();
  }

  return null;
};
