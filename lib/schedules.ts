export type DisplayWeekday = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

export const DISPLAY_WEEKDAYS: DisplayWeekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export const CLOCK_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MINUTES_PER_DAY = 24 * 60;
const MAX_SCHEDULE_DURATION_MINUTES = 12 * 60;

type ScheduleWindow = {
  start: string | null;
  end: string | null;
  days: DisplayWeekday[];
};

export const getCurrentIanaTimeZone = () => {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof timezone === 'string' && timezone.trim().length > 0 ? timezone : 'UTC';
  } catch {
    return 'UTC';
  }
};

export const isValidClockTime = (value: unknown): value is string => {
  return typeof value === 'string' && CLOCK_RE.test(value);
};

export const clockTimeToMinutes = (value: string) => {
  const match = CLOCK_RE.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours * 60 + minutes;
};

export const getScheduleDurationMinutes = (start: string, end: string) => {
  const startMinutes = clockTimeToMinutes(start);
  const endMinutes = clockTimeToMinutes(end);
  if (startMinutes === null || endMinutes === null) return null;

  const duration = (endMinutes - startMinutes + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return duration === 0 ? MINUTES_PER_DAY : duration;
};

export const isDisplayWeekday = (value: unknown): value is DisplayWeekday => {
  return typeof value === 'string' && DISPLAY_WEEKDAYS.includes(value as DisplayWeekday);
};

export const sanitizeDisplayWeekdays = (value: unknown): DisplayWeekday[] => {
  if (!Array.isArray(value)) return [];
  const nextDays = value.filter(isDisplayWeekday);
  return DISPLAY_WEEKDAYS.filter(day => nextDays.includes(day));
};

export const isScheduleEnabled = (schedule: Pick<ScheduleWindow, 'start' | 'end' | 'days'>) => {
  return !!schedule.start || !!schedule.end || schedule.days.length > 0;
};

export const validateScheduleWindow = ({start, end, days}: ScheduleWindow) => {
  if (start && !isValidClockTime(start)) return 'Start time must use HH:mm';
  if (end && !isValidClockTime(end)) return 'End time must use HH:mm';
  if (start && end) {
    const durationMinutes = getScheduleDurationMinutes(start, end);
    if (durationMinutes === null) return 'Schedule times must use HH:mm';
    if (durationMinutes > MAX_SCHEDULE_DURATION_MINUTES) {
      return 'End time must be within 12 hours after start time';
    }
  }
  if (days.some(day => !isDisplayWeekday(day))) return 'Schedule days must use valid weekdays';
  return null;
};
