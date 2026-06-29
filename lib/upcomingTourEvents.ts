import { buildPgaTourLeaderboardUrl } from './tourEventLinks';
import {
  getMajorChampionships,
  getTourScheduleForTitle,
  type MajorChampionship,
  type TourSeasonEvent,
} from './tourSchedules2026';

export const MAJOR_OUTLINE = '#C5A028';

export const EVENT_TILE_WIDTH = 110;
export const EVENT_TILE_GAP = 10;
export const EVENT_TILE_STRIDE = EVENT_TILE_WIDTH + EVENT_TILE_GAP;

export type UpcomingTourId = 'pga' | 'dp' | 'lpga' | 'liv';

export type UpcomingTourEvent = TourSeasonEvent & {
  tourId: UpcomingTourId;
  tourTitle: string;
  tourShort: string;
  tourAccent: string;
  genericLeaderboardUrl: string;
  endDate: string;
  /** Shared men's major — uses circleLabel and leaderboardUrl instead of tour abbrev. */
  isSharedMajor?: boolean;
  circleLabel?: string;
  leaderboardUrl?: string;
};

const TOUR_CONFIGS: readonly {
  id: UpcomingTourId;
  title: string;
  short: string;
  accent: string;
  genericLeaderboardUrl: string;
  sortRank: number;
}[] = [
  {
    id: 'pga',
    title: 'PGA Tour',
    short: 'PGA',
    accent: '#4A90D9',
    genericLeaderboardUrl: 'https://www.pgatour.com/leaderboard',
    sortRank: 0,
  },
  {
    id: 'dp',
    title: 'DP World Tour',
    short: 'DP',
    accent: '#1DBF73',
    genericLeaderboardUrl: 'https://www.europeantour.com/dpworld-tour/',
    sortRank: 1,
  },
  {
    id: 'lpga',
    title: 'LPGA',
    short: 'LPGA',
    accent: '#D44FA3',
    genericLeaderboardUrl: 'https://www.lpga.com/tournaments',
    sortRank: 2,
  },
  {
    id: 'liv',
    title: 'LIV Golf',
    short: 'LIV',
    accent: '#F5A623',
    genericLeaderboardUrl: 'https://www.livgolf.com/leaderboard',
    sortRank: 3,
  },
];

const MAJOR_SORT_RANK = -1;

function calendarDateStringFromLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Default four-day tournament window (Thu–Sun) when endDate is omitted. */
export function inferEventEndDate(startDate: string, explicitEndDate?: string): string {
  if (explicitEndDate) return explicitEndDate;
  const [y, m, d] = startDate.split('-').map(Number);
  const end = new Date(y, m - 1, d);
  end.setDate(end.getDate() + 3);
  return calendarDateStringFromLocal(end);
}

export function isEventLive(
  event: { startDate: string; endDate: string },
  today: Date = new Date(),
): boolean {
  const todayStr = calendarDateStringFromLocal(today);
  return todayStr >= event.startDate && todayStr <= event.endDate;
}

export function upcomingEventCurrentOrNextIndex(
  events: readonly { startDate: string }[],
  today: Date = new Date(),
): number {
  const todayStr = calendarDateStringFromLocal(today);
  const i = events.findIndex((e) => e.startDate >= todayStr);
  return i === -1 ? Math.max(0, events.length - 1) : i;
}

/** Strip scroll target: first live event, or next upcoming if none are live. */
export function upcomingEventScrollTargetIndex(
  events: readonly { startDate: string; endDate: string }[],
  today: Date = new Date(),
): number {
  const liveIndex = events.findIndex((event) => isEventLive(event, today));
  if (liveIndex !== -1) return liveIndex;
  return upcomingEventCurrentOrNextIndex(events, today);
}

function eventYear(event: Pick<TourSeasonEvent, 'startDate'>): string {
  return event.startDate.slice(0, 4);
}

function withEndDate(event: TourSeasonEvent): TourSeasonEvent & { endDate: string } {
  return {
    ...event,
    endDate: inferEventEndDate(event.startDate, event.endDate),
  };
}

function sharedMajorToUpcomingEvent(major: MajorChampionship): UpcomingTourEvent {
  const dated = withEndDate(major);
  return {
    ...dated,
    tourId: 'pga',
    tourTitle: 'Major Championship',
    tourShort: major.circleLabel,
    tourAccent: MAJOR_OUTLINE,
    genericLeaderboardUrl: major.leaderboardUrl,
    isSharedMajor: true,
    circleLabel: major.circleLabel,
    leaderboardUrl: major.leaderboardUrl,
  };
}

/** Per-event leaderboard/results URL, or null when slug data is incomplete. */
export function buildEventLeaderboardUrl(
  event: Pick<TourSeasonEvent, 'id' | 'startDate' | 'endDate' | 'slug' | 'tournId'>,
  tourId: UpcomingTourId,
): string | null {
  const slug = event.slug?.trim();
  if (!slug) return null;

  const year = eventYear(event);

  switch (tourId) {
    case 'pga':
      return buildPgaTourLeaderboardUrl(event);
    case 'dp':
      return `https://www.europeantour.com/dpworld-tour/${slug}/leaderboard`;
    case 'liv':
      return `https://www.livgolf.com/leaderboard/${year}/${slug}`;
    case 'lpga':
      return `https://www.lpga.com/tournaments/${slug}/leaderboard`;
    default:
      return null;
  }
}

export function resolveEventLeaderboardUrl(event: UpcomingTourEvent): string {
  if (event.leaderboardUrl) return event.leaderboardUrl;
  return buildEventLeaderboardUrl(event, event.tourId) ?? event.genericLeaderboardUrl;
}

export function circleLabelForEvent(event: UpcomingTourEvent): string {
  return event.circleLabel ?? event.tourShort;
}

function sortRankForEvent(event: UpcomingTourEvent): number {
  if (event.isSharedMajor) return MAJOR_SORT_RANK;
  return TOUR_CONFIGS.find((t) => t.id === event.tourId)?.sortRank ?? 99;
}

export function getMergedUpcomingTourEvents(): UpcomingTourEvent[] {
  const merged: UpcomingTourEvent[] = [];

  for (const major of getMajorChampionships()) {
    merged.push(sharedMajorToUpcomingEvent(major));
  }

  for (const tour of TOUR_CONFIGS) {
    const schedule = getTourScheduleForTitle(tour.title);
    for (const event of schedule) {
      const dated = withEndDate(event);
      merged.push({
        ...dated,
        tourId: tour.id,
        tourTitle: tour.title,
        tourShort: tour.short,
        tourAccent: tour.accent,
        genericLeaderboardUrl: tour.genericLeaderboardUrl,
      });
    }
  }

  merged.sort((a, b) => {
    const byDate = a.startDate.localeCompare(b.startDate);
    if (byDate !== 0) return byDate;
    const rankA = sortRankForEvent(a);
    const rankB = sortRankForEvent(b);
    if (rankA !== rankB) return rankA - rankB;
    return a.id.localeCompare(b.id);
  });

  return merged;
}

export function outlineColorForEvent(event: UpcomingTourEvent): string {
  return event.isMajor ? MAJOR_OUTLINE : event.tourAccent;
}
