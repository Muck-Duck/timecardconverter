import type { TimecardData } from './types';

function parseDate(dateStr: string): Date {
  // "03/01/2026" → Date
  const [mm, dd, yyyy] = dateStr.split('/').map(Number);
  return new Date(yyyy, mm - 1, dd);
}

function daysBetween(a: string, b: string): number {
  const da = parseDate(a);
  const db = parseDate(b);
  return Math.round((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Validate two timecards can be merged:
 * - Not the same period
 * - Sequential (one ends the day before the other starts, within a few days tolerance)
 * Returns null if valid, or an error message string.
 */
export function validateMerge(a: TimecardData, b: TimecardData): string | null {
  // Same period check
  if (a.periodStart === b.periodStart && a.periodEnd === b.periodEnd) {
    return 'Both files cover the same period (' + a.periodStart + ' - ' + a.periodEnd + '). Upload two different weeks.';
  }

  // Determine which is earlier
  const aStart = parseDate(a.periodStart);
  const bStart = parseDate(b.periodStart);
  const [first, second] = aStart < bStart ? [a, b] : [b, a];

  // Check sequential: first.periodEnd should be close to second.periodStart
  const gap = daysBetween(first.periodEnd, second.periodStart);

  // gap of 1 = perfectly sequential (end Sunday, start Monday)
  // gap of 0 = overlapping by a day (could happen if periods share a boundary day)
  // Allow gap of 0-2 to be flexible
  if (gap < 0) {
    return `These periods overlap. Week 1 ends ${first.periodEnd} but Week 2 starts ${second.periodStart}.`;
  }
  if (gap > 2) {
    return `These weeks aren't consecutive. Week 1 ends ${first.periodEnd} and Week 2 starts ${second.periodStart} — that's a ${gap}-day gap. Upload two consecutive weeks.`;
  }

  return null;
}

/**
 * Merge two TimecardData objects into a single combined pay period.
 * Automatically sorts so the earlier week comes first.
 */
export function mergeTimecards(a: TimecardData, b: TimecardData): TimecardData {
  const aStart = parseDate(a.periodStart);
  const bStart = parseDate(b.periodStart);
  const [first, second] = aStart < bStart ? [a, b] : [b, a];

  // Merge days, sorted by date
  const allDays = [...first.days, ...second.days]
    .sort((x, y) => parseDate(x.date).getTime() - parseDate(y.date).getTime());

  // Merge weekly bonuses
  const allWeeklyBonuses = [...first.weeklyBonuses, ...second.weeklyBonuses];

  return {
    techName: first.techName || second.techName,
    personNumber: first.personNumber || second.personNumber,
    periodStart: first.periodStart,
    periodEnd: second.periodEnd,
    manager: first.manager || second.manager,
    jobTitle: first.jobTitle || second.jobTitle,
    location: first.location || second.location,
    department: first.department || second.department,
    status: '',
    totalReportedHours: first.totalReportedHours + second.totalReportedHours,
    totalCalculatedHours: first.totalCalculatedHours + second.totalCalculatedHours,
    scheduledHours: first.scheduledHours + second.scheduledHours,
    scheduleDeviation: first.scheduleDeviation + second.scheduleDeviation,
    totalRegularHours: first.totalRegularHours + second.totalRegularHours,
    totalCommissions: first.totalCommissions + second.totalCommissions,
    days: allDays,
    weeklyBonuses: allWeeklyBonuses,
  };
}
