import type { TimeSegment, ActivityType } from './types';

/**
 * Given a day's segments (already parsed), apply the drive-time threshold rule:
 *   - First enroute of the day (no prior work activity): only excess > threshold is paid
 *   - Last arrive_home: same rule, but ONLY if the tech commuted from home
 *     (i.e., the first enroute had no prior work activity)
 *   - If ANY work activity precedes first enroute → both drives fully paid
 */
export function applyDriveTimeRules(segments: TimeSegment[], driveThresholdMinutes = 45): TimeSegment[] {
  if (segments.length === 0) return segments;

  const UNPAID_THRESHOLD = driveThresholdMinutes;

  // Find first enroute index
  const firstEnrouteIdx = segments.findIndex(s => s.activity === 'enroute');
  // Find last arrive_home index
  let lastHomeIdx = -1;
  for (let i = segments.length - 1; i >= 0; i--) {
    if (segments[i].activity === 'arrive_home') { lastHomeIdx = i; break; }
  }

  const workActivities: ActivityType[] = ['training', 'parts_pickup', 'onsite', 'clear', 'unassigned'];

  // Determine if the tech commuted from home (first enroute with no prior work)
  const hasWorkBeforeFirstEnroute = firstEnrouteIdx >= 0
    ? segments.slice(0, firstEnrouteIdx).some(s => workActivities.includes(s.activity))
    : true; // no enroute at all → no commute from home

  const commutedFromHome = firstEnrouteIdx >= 0 && !hasWorkBeforeFirstEnroute;

  segments.forEach((seg, idx) => {
    seg.unpaidMinutes = 0;
    seg.paidMinutes = Math.round((seg.endMinutes - seg.startMinutes));

    if (idx === firstEnrouteIdx) {
      seg.isFirstDrive = true;

      if (commutedFromHome) {
        const driveMins = seg.endMinutes - seg.startMinutes;
        if (driveMins <= UNPAID_THRESHOLD) {
          seg.unpaidMinutes = driveMins;
          seg.paidMinutes = 0;
        } else {
          seg.unpaidMinutes = UNPAID_THRESHOLD;
          seg.paidMinutes = driveMins - UNPAID_THRESHOLD;
        }
      }
    }

    if (idx === lastHomeIdx) {
      seg.isLastDrive = true;

      // Only apply threshold if the tech also commuted FROM home that morning
      if (commutedFromHome) {
        const driveMins = seg.endMinutes - seg.startMinutes;
        if (driveMins <= UNPAID_THRESHOLD) {
          seg.unpaidMinutes = driveMins;
          seg.paidMinutes = 0;
        } else {
          seg.unpaidMinutes = UNPAID_THRESHOLD;
          seg.paidMinutes = driveMins - UNPAID_THRESHOLD;
        }
      }
    }
  });

  return segments;
}
