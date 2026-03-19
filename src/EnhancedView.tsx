import { useState } from 'react';
import type { TimecardData, DayData, TimeSegment, ActivityType } from './types';
import styles from './EnhancedView.module.css';

interface Props { data: TimecardData; }

// ─── Activity config ──────────────────────────────────────────────────────────
const ACTIVITY_CONFIG: Record<ActivityType | 'unpaid' | 'morning_drive' | 'evening_drive', { label: string; color: string }> = {
  enroute:       { label: 'Enroute',       color: 'var(--c-enroute)' },
  onsite:        { label: 'Onsite',        color: 'var(--c-onsite)' },
  clear:         { label: 'Clear',         color: 'var(--c-onsite)' },
  training:      { label: 'Training',      color: 'var(--c-training)' },
  parts_pickup:  { label: 'Parts Pickup',  color: 'var(--c-parts)' },
  lunch:         { label: 'Lunch',         color: 'var(--c-lunch)' },
  arrive_home:   { label: 'Drive Home',    color: 'var(--c-home)' },
  unassigned:    { label: 'Unassigned',    color: 'var(--c-unassigned)' },
  unknown:       { label: 'Other',         color: 'var(--c-unassigned)' },
  unpaid:        { label: 'Unpaid Drive',  color: 'var(--c-unpaid)' },
  morning_drive: { label: 'Morning Drive', color: 'var(--c-morning-drive)' },
  evening_drive: { label: 'Evening Drive', color: 'var(--c-evening-drive)' },
};

function formatHoursMinutes(hours: number): string {
  if (hours <= 0) return '—';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatHoursDecimal(h: number): string {
  return h.toFixed(3);
}

function minsToDisplay(m: number): string {
  if (m <= 0) return '';
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h === 0) return `${rem}m`;
  if (rem === 0) return `${h}h`;
  return `${h}h ${rem}m`;
}

// ─── Stat Cards ───────────────────────────────────────────────────────────────
function StatCards({ data }: { data: TimecardData }) {
  const workedDays = data.days.filter(d => d.isWorked && d.reportedHours > 0).length;
  const totalUnpaidMins = data.days.reduce((s, d) => s + d.unpaidDriveMinutes, 0);
  const dailyBonuses = data.days.reduce((s, d) =>
    s + d.bonuses.reduce((bs, b) => bs + b.units, 0), 0
  );
  const weeklyBonusTotal = data.weeklyBonuses.reduce((s, b) => s + b.units, 0);
  const totalBonuses = dailyBonuses + weeklyBonusTotal;
  const delta = data.totalCalculatedHours - data.totalReportedHours;

  return (
    <div className={styles.statRow}>
      <div className={styles.statCard}>
        <div className={styles.statLabel}>Reported Hours</div>
        <div className={styles.statVal}>{data.totalReportedHours.toFixed(2)}</div>
        <div className={styles.statSub}>vs {data.scheduledHours.toFixed(1)} scheduled</div>
      </div>
      <div className={styles.statCard}>
        <div className={styles.statLabel}>Calculated Hours</div>
        <div className={styles.statVal}>{data.totalCalculatedHours.toFixed(2)}</div>
        <div className={styles.statSub} style={{ color: delta < 0 ? 'var(--red)' : 'var(--green)' }}>
          {delta >= 0 ? '+' : ''}{delta.toFixed(3)} from reported
        </div>
      </div>
      <div className={styles.statCard}>
        <div className={styles.statLabel}>Days Worked</div>
        <div className={styles.statVal}>{workedDays}</div>
        <div className={styles.statSub}>this period</div>
      </div>
      {totalBonuses > 0 && (
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Bonuses / Comm.</div>
          <div className={styles.statVal} style={{ color: 'var(--green)' }}>
            ${totalBonuses.toFixed(2)}
          </div>
          <div className={styles.statSub}>upsell + bonus + other</div>
        </div>
      )}
      {totalUnpaidMins > 0 && (
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Unpaid Drive</div>
          <div className={styles.statVal} style={{ color: 'var(--amber)' }}>
            {minsToDisplay(totalUnpaidMins)}
          </div>
          <div className={styles.statSub}>45-min first/last rule</div>
        </div>
      )}
    </div>
  );
}

// ─── Summary Cards ────────────────────────────────────────────────────────────
function SummaryCard({ day }: { day: DayData }) {
  if (!day.isWorked && day.bonuses.length === 0) {
    return (
      <div className={`${styles.summaryCard} ${styles.off}`}>
        <div className={styles.scDay}>{day.dayName.slice(0, 3)} · {day.shortDate}</div>
        <div className={styles.scOff}>Day off</div>
      </div>
    );
  }

  if (!day.isWorked && day.bonuses.length > 0) {
    return (
      <div className={`${styles.summaryCard} ${styles.bonus}`}>
        <div className={styles.scDay}>{day.dayName.slice(0, 3)} · {day.shortDate}</div>
        <div className={styles.scOff}>No hours worked</div>
        <div className={styles.scFlags}>
          {day.bonuses.map((b, i) => (
            <span key={i} className={`${styles.scFlag} ${styles.upsell}`}>
              {b.label} ${b.units.toFixed(2)}
            </span>
          ))}
        </div>
      </div>
    );
  }

  const hoursDisplay = formatHoursMinutes(day.reportedHours);
  const span = day.firstIn && day.lastOut ? `${day.firstIn} – ${day.lastOut}` : '—';

  return (
    <div className={`${styles.summaryCard} ${styles.worked}`}>
      <div className={styles.scDay}>{day.dayName.slice(0, 3)} · {day.shortDate}</div>
      <div className={styles.scHours}>{hoursDisplay}</div>
      <div className={styles.scSpan}>{span}</div>
      <div className={styles.scFlags}>
        {day.lunchBreak && (
          <span className={`${styles.scFlag} ${styles.lunch}`}>
            Lunch {day.lunchBreak.start} – {day.lunchBreak.end}
          </span>
        )}
        {day.jobCount > 0 && (
          <span className={`${styles.scFlag} ${styles.jobs}`}>
            {day.jobCount} job{day.jobCount !== 1 ? 's' : ''}
          </span>
        )}
        {day.hasUnpaidDrive && (
          <span className={`${styles.scFlag} ${styles.unpaid}`}>
            {day.unpaidDriveMinutes}m unpaid drive
          </span>
        )}
        {day.bonuses.map((b, i) => (
          <span key={i} className={`${styles.scFlag} ${styles.upsell}`}>
            {b.label.replace(' $', '')} ${b.units.toFixed(2)}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Timeline Bar ─────────────────────────────────────────────────────────────
function TimelineBar({ segments, dayStart, dayEnd }: {
  segments: TimeSegment[];
  dayStart: number;
  dayEnd: number;
}) {
  const span = dayEnd - dayStart;
  if (span <= 0) return null;

  const toPercent = (mins: number) => ((mins - dayStart) / span * 100).toFixed(2) + '%';
  const widthPercent = (start: number, end: number) =>
    (Math.max(0, end - start) / span * 100).toFixed(2) + '%';

  return (
    <div className={styles.tlBar}>
      {segments.map((seg, i) => {
        // Skip 0-duration segments and short unassigned in the timeline bar
        if (seg.startMinutes === seg.endMinutes) return null;
        if (seg.activity === 'unassigned' && (seg.endMinutes - seg.startMinutes) < 5) return null;
        const key = `seg-${i}`;

        // If first/last drive has unpaid portion, split it visually
        if ((seg.isFirstDrive || seg.isLastDrive) && (seg.unpaidMinutes ?? 0) > 0) {
          const unpaidEnd = seg.isFirstDrive
            ? seg.startMinutes + (seg.unpaidMinutes ?? 0)
            : seg.startMinutes + (seg.paidMinutes ?? 0);
          const paidStart = seg.isFirstDrive ? unpaidEnd : seg.startMinutes;
          const unpaidStart = seg.isFirstDrive ? seg.startMinutes : unpaidEnd;

          return (
            <div key={key} style={{ display: 'contents' }}>
              {seg.isFirstDrive && (
                <>
                  <div
                    className={styles.tlSeg}
                    style={{
                      left: toPercent(seg.startMinutes),
                      width: widthPercent(seg.startMinutes, unpaidEnd),
                      background: 'var(--c-unpaid)',
                      border: '1px dashed #bbb',
                    }}
                    title={`Unpaid drive: ${seg.unpaidMinutes}min`}
                  />
                  {(seg.paidMinutes ?? 0) > 0 && (
                    <div
                      className={styles.tlSeg}
                      style={{
                        left: toPercent(paidStart),
                        width: widthPercent(paidStart, seg.endMinutes),
                        background: ACTIVITY_CONFIG.enroute.color,
                      }}
                      title={`Paid drive: ${seg.paidMinutes}min`}
                    />
                  )}
                </>
              )}
              {seg.isLastDrive && (
                <>
                  {(seg.paidMinutes ?? 0) > 0 && (
                    <div
                      className={styles.tlSeg}
                      style={{
                        left: toPercent(seg.startMinutes),
                        width: widthPercent(seg.startMinutes, paidStart),
                        background: ACTIVITY_CONFIG.arrive_home.color,
                      }}
                      title={`Paid home drive: ${seg.paidMinutes}min`}
                    />
                  )}
                  <div
                    className={styles.tlSeg}
                    style={{
                      left: toPercent(unpaidStart),
                      width: widthPercent(unpaidStart, seg.endMinutes),
                      background: 'var(--c-unpaid)',
                      border: '1px dashed #bbb',
                    }}
                    title={`Unpaid home drive: ${seg.unpaidMinutes}min`}
                  />
                </>
              )}
            </div>
          );
        }

        const cfg = ACTIVITY_CONFIG[seg.activity] ?? ACTIVITY_CONFIG.unknown;
        return (
          <div
            key={key}
            className={styles.tlSeg}
            style={{
              left: toPercent(seg.startMinutes),
              width: widthPercent(seg.startMinutes, seg.endMinutes),
              background: cfg.color,
              opacity: seg.activity === 'unassigned' ? 0.5 : 1,
            }}
            title={`${cfg.label}: ${seg.startTime} – ${seg.endTime}`}
          />
        );
      })}
    </div>
  );
}

// ─── Timeline Day ─────────────────────────────────────────────────────────────
function TimelineDay({ day }: { day: DayData }) {
  const [open, setOpen] = useState(false);
  if (!day.isWorked || day.segments.length === 0) return null;

  const allMins = day.segments.flatMap(s => [s.startMinutes, s.endMinutes]).filter(m => m > 0);
  const dayStart = Math.max(0, Math.min(...allMins) - 15);
  const dayEnd = Math.max(...allMins) + 15;

  const startLabel = day.firstIn ?? '';
  const endLabel = day.lastOut ?? '';

  // Build time axis labels
  const startHour = Math.floor(dayStart / 60);
  const endHour = Math.ceil(dayEnd / 60);
  const timeLabels: string[] = [];
  for (let h = startHour; h <= endHour; h += 2) {
    const ampm = h >= 12 ? 'PM' : 'AM';
    const disp = h > 12 ? h - 12 : h === 0 ? 12 : h;
    timeLabels.push(`${disp} ${ampm}`);
  }

  return (
    <div className={styles.timelineDay}>
      <div className={styles.tlHeader} onClick={() => setOpen(!open)}>
        <div className={styles.tlHeaderLeft}>
          <span className={styles.tlDayName}>{day.dayName}</span>
          <span className={styles.tlDayMeta}>{startLabel} – {endLabel}</span>
        </div>
        <div className={styles.tlHeaderRight}>
          {day.hasUnpaidDrive && (
            <span className={`${styles.scFlag} ${styles.unpaid}`}>
              {day.unpaidDriveMinutes}m unpaid
            </span>
          )}
          {day.bonuses.length > 0 && day.bonuses.map((b, i) => (
            <span key={i} className={`${styles.scFlag} ${styles.upsell}`}>
              {b.label.includes('Upsell') ? `Upsell $${b.units.toFixed(2)}` :
               b.label.includes('Bonus') ? `Bonus $${b.units.toFixed(2)}` : b.label}
            </span>
          ))}
          <span className={styles.tlTotal}>{formatHoursMinutes(day.reportedHours)}</span>
          <span className={`${styles.tlChevron} ${open ? styles.open : ''}`}>▼</span>
        </div>
      </div>

      {open && (
        <div className={styles.tlBody}>
          {/* Visual bar */}
          <div className={styles.tlBarWrap}>
            <div className={styles.tlTimeLabels}>
              {timeLabels.map((l, i) => (
                <span key={i}>{l}</span>
              ))}
            </div>
            <TimelineBar segments={day.segments} dayStart={dayStart} dayEnd={dayEnd} />
          </div>

          {/* Segment list */}
          <div className={styles.segList}>
            {day.segments
              .filter(seg => {
                const durMins = seg.endMinutes - seg.startMinutes;
                // Hide unassigned segments under 5 minutes (both real and gap-fill)
                if (seg.activity === 'unassigned' && durMins < 5) return false;
                return true;
              })
              .map((seg, i) => {
                const cfg = ACTIVITY_CONFIG[seg.activity] ?? ACTIVITY_CONFIG.unknown;
                const isUnpaidDrive = (seg.isFirstDrive || seg.isLastDrive) && (seg.unpaidMinutes ?? 0) > 0;
                const durMins = seg.endMinutes - seg.startMinutes;
                const label = seg.isGap ? 'Gap (Unaccounted)' : cfg.label;
                const dotStyle = seg.isGap
                  ? { background: 'transparent', border: '2px dashed var(--c-unassigned)' }
                  : { background: isUnpaidDrive ? 'var(--c-unpaid)' : cfg.color, border: isUnpaidDrive ? '1px dashed #aaa' : 'none' };

                return (
                  <div key={i} className={styles.segRow} style={seg.isGap ? { opacity: 0.7 } : undefined}>
                    <div
                      className={styles.segDot}
                      style={dotStyle}
                    />
                    <div className={`${styles.segTimes} ${styles.mono}`}>
                      {seg.startTime} – {seg.endTime}
                    </div>
                    <div className={styles.segLabel}>{label}</div>
                    {seg.isFirstDrive && !isUnpaidDrive && (
                      <span className={styles.segNote}>fully paid</span>
                    )}
                    {isUnpaidDrive && (
                      <span className={styles.segUnpaid}>
                        {seg.unpaidMinutes}m unpaid · {seg.paidMinutes}m paid
                      </span>
                    )}
                    {seg.jobNumber && (
                      <div className={`${styles.segJob} ${styles.mono}`}>#{seg.jobNumber}</div>
                    )}
                    <div className={`${styles.segDur} ${styles.mono}`}>
                      {minsToDisplay(durMins)}
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Legend */}
          <div className={styles.legend}>
            {Object.entries(ACTIVITY_CONFIG)
              .filter(([k]) => day.segments.some(s => s.activity === k || (k === 'unpaid' && s.unpaidMinutes && s.unpaidMinutes > 0)))
              .map(([k, v]) => (
                <div key={k} className={styles.legendItem}>
                  <div className={styles.legendDot} style={{ background: v.color }} />
                  {v.label}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Reported vs Calculated ───────────────────────────────────────────────────
function ReportedVsCalc({ data }: { data: TimecardData }) {
  const workedDays = data.days.filter(d => d.reportedHours > 0 || d.calculatedHours > 0);

  return (
    <table className={styles.rvTable}>
      <thead>
        <tr>
          <th>Date</th>
          <th>Day</th>
          <th>Reported</th>
          <th>Calculated</th>
          <th>Delta</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        {workedDays.map(day => {
          const delta = day.calculatedHours - day.reportedHours;
          const isUnitsDay = day.bonuses.length > 0 && !day.isWorked;
          return (
            <tr key={day.date}>
              <td className={styles.mono}>{day.shortDate}</td>
              <td>{day.dayName}</td>
              <td className={styles.mono}>
                {isUnitsDay ? `${day.bonuses.reduce((s,b)=>s+b.units,0).toFixed(1)} units` : formatHoursDecimal(day.reportedHours)}
              </td>
              <td className={styles.mono}>
                {isUnitsDay ? '—' : formatHoursDecimal(day.calculatedHours)}
              </td>
              <td className={styles.mono}>
                {isUnitsDay ? (
                  <span className={styles.deltaZero}>—</span>
                ) : delta < -0.001 ? (
                  <span className={styles.deltaNeg}>{delta.toFixed(3)}</span>
                ) : delta > 0.001 ? (
                  <span className={styles.deltaPos}>+{delta.toFixed(3)}</span>
                ) : (
                  <span className={styles.deltaZero}>0.000</span>
                )}
              </td>
              <td className={styles.noteCell}>
                {day.hasUnpaidDrive && (
                  <span className={`${styles.scFlag} ${styles.unpaid}`}>
                    {day.unpaidDriveMinutes}m drive adj
                  </span>
                )}
                {Math.abs(delta) > 0.8 && !day.hasUnpaidDrive && (
                  <span className={`${styles.scFlag} ${styles.unpaid}`}>
                    Review this day
                  </span>
                )}
              </td>
            </tr>
          );
        })}
        <tr className={styles.totalRow}>
          <td colSpan={2}><strong>Total</strong></td>
          <td className={styles.mono}><strong>{formatHoursDecimal(data.totalReportedHours)}</strong></td>
          <td className={styles.mono}><strong>{formatHoursDecimal(data.totalCalculatedHours)}</strong></td>
          <td className={styles.mono}>
            <span className={styles.deltaNeg}>
              {(data.totalCalculatedHours - data.totalReportedHours).toFixed(3)}
            </span>
          </td>
          <td></td>
        </tr>
      </tbody>
    </table>
  );
}

// ─── Main Enhanced View ───────────────────────────────────────────────────────
export default function EnhancedView({ data }: Props) {
  const [subTab, setSubTab] = useState<'summary' | 'timeline' | 'reported'>('summary');

  return (
    <div className={styles.container}>
      <StatCards data={data} />

      {data.weeklyBonuses.length > 0 && (
        <div className={styles.weeklyBonusBar}>
          <div className={styles.weeklyBonusTitle}>Weekly Bonuses</div>
          <div className={styles.weeklyBonusItems}>
            {data.weeklyBonuses.map((b, i) => (
              <div key={i} className={styles.weeklyBonusItem}>
                <span className={styles.weeklyBonusName}>{b.label || b.payType}</span>
                <span className={styles.weeklyBonusAmt}>${b.units.toFixed(2)}</span>
                {b.note && <span className={styles.weeklyBonusNote}>{b.note}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.subTabs}>
        {(['summary', 'timeline', 'reported'] as const).map(tab => (
          <div
            key={tab}
            className={`${styles.subTab} ${subTab === tab ? styles.active : ''}`}
            onClick={() => setSubTab(tab)}
          >
            {tab === 'summary' ? 'Summary' : tab === 'timeline' ? 'Daily Timeline' : 'Reported vs Calculated'}
          </div>
        ))}
      </div>

      {subTab === 'summary' && (
        <div className={styles.summaryGrid}>
          {data.days.map(day => <SummaryCard key={day.date} day={day} />)}
        </div>
      )}

      {subTab === 'timeline' && (
        <div className={styles.timelineDays}>
          {data.days.filter(d => d.isWorked).map(day => (
            <TimelineDay key={day.date} day={day} />
          ))}
        </div>
      )}

      {subTab === 'reported' && <ReportedVsCalc data={data} />}
    </div>
  );
}
