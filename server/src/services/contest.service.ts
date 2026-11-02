import type { UpcomingContest, VirtualContestSuggestion } from '@cgp/shared';
import type { RawContest } from './codeforces.service.js';
import { getServices } from './container.js';

// Upcoming rounds and virtual contest suggestions come from contest.list.
// Suggested divisions depend only on the user's rating.

export function suitableDivisions(rating: number): RegExp {
  if (rating < 1400) return /Div\. ?4|Div\. ?3/i;
  if (rating < 1900) return /Div\. ?3|Div\. ?2|Educational/i;
  return /Div\. ?2|Div\. ?1|Educational/i;
}

export function toUpcoming(contests: readonly RawContest[], now = Date.now()): UpcomingContest[] {
  return contests
    .filter((c) => c.phase === 'BEFORE' && typeof c.startTimeSeconds === 'number' && c.startTimeSeconds * 1000 > now)
    .sort((a, b) => a.startTimeSeconds! - b.startTimeSeconds!)
    .map((c) => ({
      id: c.id,
      name: c.name,
      startTime: new Date(c.startTimeSeconds! * 1000).toISOString(),
      durationSeconds: c.durationSeconds,
      url: `https://codeforces.com/contests/${c.id}`,
    }));
}

export function suggestVirtualContests(
  contests: readonly RawContest[],
  rating: number,
  alreadyDone: ReadonlySet<number>,
  limit = 5,
): VirtualContestSuggestion[] {
  const divisions = suitableDivisions(rating);
  return contests
    .filter((c) => c.phase === 'FINISHED' && divisions.test(c.name) && !alreadyDone.has(c.id) && typeof c.startTimeSeconds === 'number')
    .sort((a, b) => b.startTimeSeconds! - a.startTimeSeconds!)
    .slice(0, limit)
    .map((c) => ({
      id: c.id,
      name: c.name,
      startTime: new Date(c.startTimeSeconds! * 1000).toISOString(),
      url: `https://codeforces.com/contest/${c.id}`,
      reason: `Recent round from a division that fits a ${rating} rating. Do it as a virtual contest with the real time limit.`,
    }));
}

export async function getContestOverview(rating: number, alreadyDone: ReadonlySet<number>) {
  try {
    const contests = await getServices().codeforces.getContests();
    return {
      available: true,
      upcoming: toUpcoming(contests).slice(0, 10),
      virtualSuggestions: suggestVirtualContests(contests, rating, alreadyDone),
    };
  } catch {
    // Contest information is optional; the page still works without it.
    return { available: false, upcoming: [], virtualSuggestions: [] };
  }
}
