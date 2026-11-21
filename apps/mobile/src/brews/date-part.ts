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
