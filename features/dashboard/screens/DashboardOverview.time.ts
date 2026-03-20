const TIME_OPTIONS = [
  '00:00',
  '05:00',
  '06:00',
  '07:00',
  '08:00',
  '09:00',
  '10:00',
  '17:00',
  '18:00',
  '20:00',
  '22:00',
  '23:00',
];

export function cycleTimeOption(current: string, delta: 1 | -1) {
  const index = TIME_OPTIONS.indexOf(current);
  const safeIndex = index === -1 ? 0 : index;
  const nextIndex = (safeIndex + delta + TIME_OPTIONS.length) % TIME_OPTIONS.length;
  return TIME_OPTIONS[nextIndex];
}
