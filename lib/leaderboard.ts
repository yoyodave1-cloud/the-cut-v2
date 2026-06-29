export type PgaTournamentPhase = 'live' | 'completed' | 'upcoming';

function calendarDateStringFromLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Default four-day tournament window (Thu–Sun) when endDate is omitted. */
function inferEventEndDate(startDate: string, explicitEndDate?: string): string {
  if (explicitEndDate) return explicitEndDate;
  const [y, m, d] = startDate.split('-').map(Number);
  const end = new Date(y, m - 1, d);
  end.setDate(end.getDate() + 3);
  return calendarDateStringFromLocal(end);
}

/**
 * PGA Tour event phase from schedule dates.
 * Live through the end of endDate (inclusive); completed from the day after endDate.
 */
export function pgaEventPhase(
  event: { startDate: string; endDate?: string },
  today: Date = new Date(),
): PgaTournamentPhase {
  const endDate = inferEventEndDate(event.startDate, event.endDate);
  const todayStr = calendarDateStringFromLocal(today);
  if (todayStr < event.startDate) return 'upcoming';
  if (todayStr <= endDate) return 'live';
  return 'completed';
}

/** Currently in-progress PGA Tour event from a schedule, if any. */
export function resolvePgaActiveLeaderboardTournament<T extends { startDate: string; endDate?: string }>(
  schedule: readonly T[],
  today: Date = new Date(),
): T | null {
  return schedule.find((event) => pgaEventPhase(event, today) === 'live') ?? null;
}
