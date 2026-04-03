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

const FALLBACK_HOURS = 0;
const FALLBACK_MINUTES = 0;

function parseTimeParts(value: string) {
  const [rawHours, rawMinutes] = value.split(':');
  const hours = Number(rawHours);
  const minutes = Number(rawMinutes);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return {hours: FALLBACK_HOURS, minutes: FALLBACK_MINUTES};
  }

  return {hours, minutes};
}

export function timeValueToDate(value: string) {
  const {hours, minutes} = parseTimeParts(value);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

export function dateToTimeValue(date: Date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function formatTimeValueLabel(value: string) {
  const {hours, minutes} = parseTimeParts(value);
  const meridiem = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${String(minutes).padStart(2, '0')} ${meridiem}`;
}

export function cycleTimeOption(current: string, delta: 1 | -1) {
  const index = TIME_OPTIONS.indexOf(current);
  const safeIndex = index === -1 ? 0 : index;
  const nextIndex = (safeIndex + delta + TIME_OPTIONS.length) % TIME_OPTIONS.length;
  return TIME_OPTIONS[nextIndex];
}
