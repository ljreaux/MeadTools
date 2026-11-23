/**
 * Android's Material date picker reads its starting date as a UTC calendar
 * day, so pass the brew's local day as midnight UTC. Otherwise an evening
 * start west of UTC (or an early-morning one east of it) opens on the wrong
 * day.
 */
export function pickerDayFor(current: Date): Date {
  return new Date(Date.UTC(current.getFullYear(), current.getMonth(), current.getDate()));
}

/**
 * Android's Material date picker reports the chosen day as midnight UTC.
 * Keep the brew's local time of day and move only the calendar day.
 */
export function withPickedDay(pickedUtcMidnight: Date, current: Date): Date {
  const next = new Date(current.getTime());
  next.setFullYear(
    pickedUtcMidnight.getUTCFullYear(),
    pickedUtcMidnight.getUTCMonth(),
    pickedUtcMidnight.getUTCDate()
  );
  return next;
}

/** Keep the brew's calendar day and take the hour and minute from the picker. */
export function withPickedTime(picked: Date, current: Date): Date {
  const next = new Date(current.getTime());
  next.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
  return next;
}
