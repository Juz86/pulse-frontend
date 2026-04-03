export function isWithinQuietHours(scheduleRules, now = new Date()) {
  if (!scheduleRules?.quietHoursEnabled) return false;
  if (!scheduleRules.quietHoursStart || !scheduleRules.quietHoursEnd) return false;

  const [startHour, startMinute] = scheduleRules.quietHoursStart.split(':').map(Number);
  const [endHour, endMinute] = scheduleRules.quietHoursEnd.split(':').map(Number);

  if (
    Number.isNaN(startHour) ||
    Number.isNaN(startMinute) ||
    Number.isNaN(endHour) ||
    Number.isNaN(endMinute)
  ) {
    return false;
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;

  if (startMinutes === endMinutes) return false;
  if (startMinutes < endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }

  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}
