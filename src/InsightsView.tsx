import type { TimecardData, ActivityType } from './types';
import styles from './InsightsView.module.css';

interface Props { data: TimecardData; }

const ACTIVITY_LABELS: Record<ActivityType, string> = {
  onsite: 'Onsite', enroute: 'Driving', training: 'Training',
  parts_pickup: 'Parts Run', lunch: 'Lunch', arrive_home: 'Drive Home',
  unassigned: 'Unassigned', clear: 'Clear', unknown: 'Other',
};

const ACTIVITY_COLORS: Record<ActivityType, string> = {
  onsite: 'var(--c-onsite)', enroute: 'var(--c-enroute)', training: 'var(--c-training)',
  parts_pickup: 'var(--c-parts)', lunch: 'var(--c-lunch)', arrive_home: 'var(--c-home)',
  unassigned: 'var(--c-unassigned)', clear: 'var(--c-onsite)', unknown: 'var(--c-unassigned)',
};

function fmt(mins: number): string {
  if (mins <= 0) return '0m';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function pct(n: number, total: number): string {
  if (total === 0) return '0';
  return (n / total * 100).toFixed(1);
}

export default function InsightsView({ data }: Props) {
  const workedDays = data.days.filter(d => d.isWorked && d.reportedHours > 0);
  const allSegments = workedDays.flatMap(d => d.segments);

  // ── Time by activity ──
  const byActivity = new Map<ActivityType, number>();
  for (const seg of allSegments) {
    const mins = seg.endMinutes - seg.startMinutes;
    if (mins <= 0) continue;
    byActivity.set(seg.activity, (byActivity.get(seg.activity) ?? 0) + mins);
  }
  // Remove clear (0-duration) and sort by time descending
  byActivity.delete('clear');
  const activityEntries = [...byActivity.entries()]
    .filter(([, mins]) => mins > 0)
    .sort((a, b) => b[1] - a[1]);
  const totalTrackedMins = activityEntries.reduce((s, [, m]) => s + m, 0);

  const onsiteMins = byActivity.get('onsite') ?? 0;
  const driveMins = (byActivity.get('enroute') ?? 0) + (byActivity.get('arrive_home') ?? 0);

  // ── Job stats ──
  const onsiteSegments = allSegments.filter(s => s.activity === 'onsite' && s.durationHours > 0);
  const jobDurations = new Map<string, number>();
  for (const seg of onsiteSegments) {
    if (!seg.jobNumber) continue;
    jobDurations.set(seg.jobNumber, (jobDurations.get(seg.jobNumber) ?? 0) + (seg.endMinutes - seg.startMinutes));
  }
  const uniqueJobs = jobDurations.size;
  const jobDurValues = [...jobDurations.values()];
  const avgJobMins = jobDurValues.length > 0 ? jobDurValues.reduce((s, m) => s + m, 0) / jobDurValues.length : 0;
  const longestJob = jobDurValues.length > 0 ? Math.max(...jobDurValues) : 0;
  const shortestJob = jobDurValues.length > 0 ? Math.min(...jobDurValues) : 0;
  const longestJobNum = [...jobDurations.entries()].find(([, m]) => m === longestJob)?.[0];
  const shortestJobNum = [...jobDurations.entries()].find(([, m]) => m === shortestJob)?.[0];

  // ── Drive stats ──
  const driveSegments = allSegments.filter(s => s.activity === 'enroute' && (s.endMinutes - s.startMinutes) > 0);
  const avgDriveMins = driveSegments.length > 0
    ? driveSegments.reduce((s, seg) => s + seg.endMinutes - seg.startMinutes, 0) / driveSegments.length
    : 0;
  const longestDrive = driveSegments.length > 0
    ? Math.max(...driveSegments.map(s => s.endMinutes - s.startMinutes))
    : 0;
  const longestDriveSeg = driveSegments.find(s => (s.endMinutes - s.startMinutes) === longestDrive);

  // ── Daily hours for bar chart ──
  const maxDayHours = Math.max(...workedDays.map(d => d.reportedHours), 1);

  // ── Fun facts ──
  const busiestDay = workedDays.length > 0
    ? workedDays.reduce((a, b) => a.reportedHours > b.reportedHours ? a : b)
    : null;
  const lightestDay = workedDays.length > 0
    ? workedDays.reduce((a, b) => a.reportedHours < b.reportedHours ? a : b)
    : null;
  const earliestPunch = workedDays.length > 0
    ? workedDays.reduce((earliest, d) => {
        const segs = d.segments.filter(s => s.startMinutes > 0);
        const first = segs.length > 0 ? Math.min(...segs.map(s => s.startMinutes)) : Infinity;
        return first < earliest.mins ? { mins: first, day: d } : earliest;
      }, { mins: Infinity, day: workedDays[0] })
    : null;
  const latestPunch = workedDays.length > 0
    ? workedDays.reduce((latest, d) => {
        const last = d.segments.length > 0 ? Math.max(...d.segments.map(s => s.endMinutes)) : 0;
        return last > latest.mins ? { mins: last, day: d } : latest;
      }, { mins: 0, day: workedDays[0] })
    : null;

  // ── Gaps (unaccounted time) ──
  const gapSegments = allSegments.filter(s => s.isGap);
  const totalGapMins = gapSegments.reduce((s, seg) => s + seg.endMinutes - seg.startMinutes, 0);

  // ── Unpaid drive ──
  const totalUnpaidMins = workedDays.reduce((s, d) => s + d.unpaidDriveMinutes, 0);

  // ── Weekly bonuses ──
  const weeklyBonusTotal = data.weeklyBonuses.reduce((s, b) => s + b.units, 0);
  const dailyUpsellTotal = data.days.reduce((s, d) => s + d.bonuses.reduce((bs, b) => bs + b.units, 0), 0);

  return (
    <div className={styles.container}>

      {/* ── Hero stats ── */}
      <div className={styles.heroRow}>
        <div className={styles.heroCard}>
          <div className={styles.heroVal}>{workedDays.length}</div>
          <div className={styles.heroLabel}>Days Worked</div>
        </div>
        <div className={styles.heroCard}>
          <div className={styles.heroVal}>{data.totalReportedHours.toFixed(1)}</div>
          <div className={styles.heroLabel}>Total Hours</div>
        </div>
        <div className={styles.heroCard}>
          <div className={styles.heroVal}>{uniqueJobs}</div>
          <div className={styles.heroLabel}>Unique Jobs</div>
        </div>
        {(weeklyBonusTotal + dailyUpsellTotal) > 0 && (
          <div className={styles.heroCard}>
            <div className={styles.heroVal} style={{ color: 'var(--green)' }}>
              ${(weeklyBonusTotal + dailyUpsellTotal).toFixed(0)}
            </div>
            <div className={styles.heroLabel}>Total Bonuses</div>
          </div>
        )}
      </div>

      <div className={styles.grid}>

        {/* ── Time Breakdown ── */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>Time Breakdown</div>
          <div className={styles.breakdownBar}>
            {activityEntries.map(([act, mins]) => (
              <div
                key={act}
                className={styles.breakdownSeg}
                style={{
                  width: `${pct(mins, totalTrackedMins)}%`,
                  background: ACTIVITY_COLORS[act],
                }}
                title={`${ACTIVITY_LABELS[act]}: ${fmt(mins)} (${pct(mins, totalTrackedMins)}%)`}
              />
            ))}
          </div>
          <div className={styles.breakdownLegend}>
            {activityEntries.map(([act, mins]) => (
              <div key={act} className={styles.breakdownItem}>
                <span className={styles.breakdownDot} style={{ background: ACTIVITY_COLORS[act] }} />
                <span className={styles.breakdownName}>{ACTIVITY_LABELS[act]}</span>
                <span className={styles.breakdownTime}>{fmt(mins)}</span>
                <span className={styles.breakdownPct}>{pct(mins, totalTrackedMins)}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Daily Hours ── */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>Daily Hours</div>
          <div className={styles.dailyBars}>
            {data.days.map(day => {
              const isWorked = day.isWorked && day.reportedHours > 0;
              return (
                <div key={day.date} className={styles.dayBarRow}>
                  <div className={styles.dayBarLabel}>
                    {day.dayName.slice(0, 3)}
                  </div>
                  <div className={styles.dayBarTrack}>
                    {isWorked && (
                      <div
                        className={styles.dayBarFill}
                        style={{ width: `${(day.reportedHours / maxDayHours) * 100}%` }}
                      />
                    )}
                  </div>
                  <div className={styles.dayBarVal}>
                    {isWorked ? `${day.reportedHours.toFixed(1)}h` : 'Off'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Job Stats ── */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>Job Stats</div>
          <div className={styles.statList}>
            <div className={styles.statItem}>
              <span className={styles.statItemLabel}>Unique jobs</span>
              <span className={styles.statItemVal}>{uniqueJobs}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statItemLabel}>Avg time per job</span>
              <span className={styles.statItemVal}>{fmt(avgJobMins)}</span>
            </div>
            {longestJobNum && (
              <div className={styles.statItem}>
                <span className={styles.statItemLabel}>Longest job</span>
                <span className={styles.statItemVal}>{fmt(longestJob)} <span className={styles.statItemSub}>#{longestJobNum}</span></span>
              </div>
            )}
            {shortestJobNum && uniqueJobs > 1 && (
              <div className={styles.statItem}>
                <span className={styles.statItemLabel}>Shortest job</span>
                <span className={styles.statItemVal}>{fmt(shortestJob)} <span className={styles.statItemSub}>#{shortestJobNum}</span></span>
              </div>
            )}
            <div className={styles.statItem}>
              <span className={styles.statItemLabel}>Total onsite</span>
              <span className={styles.statItemVal}>{fmt(onsiteMins)}</span>
            </div>
          </div>
        </div>

        {/* ── Drive Stats ── */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>Drive Stats</div>
          <div className={styles.statList}>
            <div className={styles.statItem}>
              <span className={styles.statItemLabel}>Total drive time</span>
              <span className={styles.statItemVal}>{fmt(driveMins)}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statItemLabel}>Drives this week</span>
              <span className={styles.statItemVal}>{driveSegments.length}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statItemLabel}>Avg per drive</span>
              <span className={styles.statItemVal}>{fmt(avgDriveMins)}</span>
            </div>
            {longestDriveSeg && (
              <div className={styles.statItem}>
                <span className={styles.statItemLabel}>Longest drive</span>
                <span className={styles.statItemVal}>
                  {fmt(longestDrive)}
                  {longestDriveSeg.jobNumber && <span className={styles.statItemSub}> to #{longestDriveSeg.jobNumber}</span>}
                </span>
              </div>
            )}
            {totalUnpaidMins > 0 && (
              <div className={styles.statItem}>
                <span className={styles.statItemLabel}>Unpaid drive (threshold)</span>
                <span className={styles.statItemVal} style={{ color: 'var(--amber)' }}>{fmt(totalUnpaidMins)}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Fun Facts ── */}
        <div className={`${styles.card} ${styles.cardWide}`}>
          <div className={styles.cardTitle}>Week Highlights</div>
          <div className={styles.factGrid}>
            {busiestDay && (
              <div className={styles.factItem}>
                <div className={styles.factIcon}>&#x1f525;</div>
                <div>
                  <div className={styles.factTitle}>Busiest Day</div>
                  <div className={styles.factVal}>{busiestDay.dayName} — {busiestDay.reportedHours.toFixed(1)}h</div>
                </div>
              </div>
            )}
            {lightestDay && workedDays.length > 1 && (
              <div className={styles.factItem}>
                <div className={styles.factIcon}>&#x1f33f;</div>
                <div>
                  <div className={styles.factTitle}>Lightest Day</div>
                  <div className={styles.factVal}>{lightestDay.dayName} — {lightestDay.reportedHours.toFixed(1)}h</div>
                </div>
              </div>
            )}
            {earliestPunch && earliestPunch.mins < Infinity && (
              <div className={styles.factItem}>
                <div className={styles.factIcon}>&#x1f305;</div>
                <div>
                  <div className={styles.factTitle}>Earliest Punch</div>
                  <div className={styles.factVal}>
                    {earliestPunch.day.segments.find(s => s.startMinutes === earliestPunch.mins)?.startTime ?? '—'} on {earliestPunch.day.dayName}
                  </div>
                </div>
              </div>
            )}
            {latestPunch && latestPunch.mins > 0 && (
              <div className={styles.factItem}>
                <div className={styles.factIcon}>&#x1f319;</div>
                <div>
                  <div className={styles.factTitle}>Latest Punch</div>
                  <div className={styles.factVal}>
                    {latestPunch.day.segments.find(s => s.endMinutes === latestPunch.mins)?.endTime ?? '—'} on {latestPunch.day.dayName}
                  </div>
                </div>
              </div>
            )}
            {totalGapMins > 0 && (
              <div className={styles.factItem}>
                <div className={styles.factIcon}>&#x23f3;</div>
                <div>
                  <div className={styles.factTitle}>Unaccounted Time</div>
                  <div className={styles.factVal}>{fmt(totalGapMins)} across {gapSegments.length} gap{gapSegments.length !== 1 ? 's' : ''}</div>
                </div>
              </div>
            )}
            {workedDays.length > 0 && (
              <div className={styles.factItem}>
                <div className={styles.factIcon}>&#x1f4c8;</div>
                <div>
                  <div className={styles.factTitle}>Avg Hours / Day</div>
                  <div className={styles.factVal}>{(data.totalReportedHours / workedDays.length).toFixed(1)}h across {workedDays.length} days</div>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
