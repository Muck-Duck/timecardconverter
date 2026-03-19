import { useState, useEffect } from 'react';
import type { TimecardData, DayData } from './types';
import styles from './CheckEstimator.module.css';

interface Props { data: TimecardData; driveThreshold: number; }

const RATE_KEY = 'tc-hourly-rate';
const OT_CAP = 40;

interface WeekCalc {
  label: string;
  totalHours: number;
  ptoHours: number;
  workedHours: number;
  regularHours: number;
  overtimeHours: number;
}

function calcWeek(days: DayData[], label: string, driveThreshold: number): WeekCalc {
  // Calculate PAID hours only:
  // - Exclude meal breaks (unpaid)
  // - Exclude gap segments (unaccounted time)
  // - Deduct drive threshold from first enroute (no prior work) and ALL arrive_home
  //   Payroll always deducts arrive_home regardless of whether you commuted from home
  let paidHours = 0;
  let ptoHours = 0;

  for (const day of days) {
    const segs = day.segments;

    // Find first enroute and check if work preceded it
    const firstEnrouteIdx = segs.findIndex(s => s.activity === 'enroute');
    const workActivities = ['training', 'parts_pickup', 'onsite', 'clear', 'unassigned'];
    const hasWorkBeforeFirstEnroute = firstEnrouteIdx > 0 &&
      segs.slice(0, firstEnrouteIdx).some(s => workActivities.includes(s.activity));

    // Find last arrive_home
    let lastHomeIdx = -1;
    for (let i = segs.length - 1; i >= 0; i--) {
      if (segs[i].activity === 'arrive_home') { lastHomeIdx = i; break; }
    }

    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];

      // Skip meal breaks — unpaid
      if (seg.payType === 'meal_break' || seg.activity === 'lunch') continue;

      // Skip gap segments — unaccounted time, not paid
      if (seg.isGap) continue;

      // PTO tracked separately
      if (seg.payType === 'pto') {
        ptoHours += seg.durationHours;
        continue;
      }

      const durMins = seg.endMinutes - seg.startMinutes;

      // First enroute with no prior work activity → deduct threshold
      if (i === firstEnrouteIdx && !hasWorkBeforeFirstEnroute && durMins > 0) {
        const unpaid = Math.min(durMins, driveThreshold);
        paidHours += Math.max(0, durMins - unpaid) / 60;
        continue;
      }

      // Last arrive_home → always deduct threshold (payroll always deducts this)
      if (i === lastHomeIdx && durMins > 0) {
        const unpaid = Math.min(durMins, driveThreshold);
        paidHours += Math.max(0, durMins - unpaid) / 60;
        continue;
      }

      // Everything else — use the XLSX quantity as-is
      paidHours += seg.durationHours;
    }
  }

  const totalHours = paidHours + ptoHours;
  const workedHours = paidHours; // non-PTO paid hours

  let regularHours: number;
  let overtimeHours: number;
  if (workedHours > OT_CAP) {
    regularHours = OT_CAP;
    overtimeHours = workedHours - OT_CAP;
  } else {
    regularHours = workedHours;
    overtimeHours = 0;
  }

  return { label, totalHours, ptoHours, workedHours, regularHours, overtimeHours };
}

function splitIntoWeeks(data: TimecardData, driveThreshold: number): WeekCalc[] {
  const days = data.days;
  if (days.length === 0) return [];

  // Parse period start to figure out week boundaries
  const [mm, dd, yyyy] = data.periodStart.split('/').map(Number);
  const periodStart = new Date(yyyy, mm - 1, dd);

  const week1Days: DayData[] = [];
  const week2Days: DayData[] = [];

  for (const day of days) {
    const [dm, ddd, dy] = day.date.split('/').map(Number);
    const dayDate = new Date(dy, dm - 1, ddd);
    const diffDays = Math.round((dayDate.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 7) {
      week1Days.push(day);
    } else {
      week2Days.push(day);
    }
  }

  const weeks: WeekCalc[] = [];
  if (week1Days.length > 0) {
    weeks.push(calcWeek(week1Days, week2Days.length > 0 ? 'Week 1' : 'This Week', driveThreshold));
  }
  if (week2Days.length > 0) {
    weeks.push(calcWeek(week2Days, 'Week 2', driveThreshold));
  }
  return weeks;
}

export default function CheckEstimator({ data, driveThreshold }: Props) {
  const [rate, setRate] = useState<number>(() => {
    const saved = localStorage.getItem(RATE_KEY);
    return saved ? parseFloat(saved) : 0;
  });

  useEffect(() => {
    if (rate > 0) localStorage.setItem(RATE_KEY, String(rate));
  }, [rate]);

  const weeks = splitIntoWeeks(data, driveThreshold);
  const isMultiWeek = weeks.length > 1;

  // Totals across all weeks
  const totalReported = weeks.reduce((s, w) => s + w.totalHours, 0);
  const totalPto = weeks.reduce((s, w) => s + w.ptoHours, 0);
  const totalWorked = weeks.reduce((s, w) => s + w.workedHours, 0);
  const totalRegular = weeks.reduce((s, w) => s + w.regularHours, 0);
  const totalOt = weeks.reduce((s, w) => s + w.overtimeHours, 0);

  const otRate = rate * 1.5;
  const regularPay = totalRegular * rate;
  const ptoPay = totalPto * rate;
  const otPay = totalOt * otRate;
  const hourlyTotal = regularPay + ptoPay + otPay;

  // Bonuses
  const dailyBonusTotal = data.days.reduce((s, d) =>
    s + d.bonuses.reduce((bs, b) => bs + b.units, 0), 0);
  const weeklyBonusTotal = data.weeklyBonuses.reduce((s, b) => s + b.units, 0);
  const totalBonuses = dailyBonusTotal + weeklyBonusTotal;

  const grossPay = hourlyTotal + totalBonuses;
  const hasRate = rate > 0;

  return (
    <div className={styles.container}>

      {/* Rate input */}
      <div className={styles.rateCard}>
        <div className={styles.rateLabel}>Your Hourly Rate</div>
        <div className={styles.rateInputRow}>
          <span className={styles.rateDollar}>$</span>
          <input
            type="number"
            min={0}
            step={0.01}
            value={rate || ''}
            onChange={e => setRate(Math.max(0, parseFloat(e.target.value) || 0))}
            placeholder="0.00"
            className={styles.rateInput}
          />
          <span className={styles.rateUnit}>/ hr</span>
        </div>
        <div className={styles.rateSub}>Saved locally — never sent anywhere</div>
      </div>

      {/* Per-week breakdown (if multi-week) */}
      {isMultiWeek && weeks.map((wk, wi) => (
        <div key={wi} className={styles.breakdownCard}>
          <div className={styles.sectionTitle}>{wk.label}</div>
          <div className={styles.breakdownGrid}>
            <div className={styles.bRow}>
              <span className={styles.bLabel}>Paid hours</span>
              <span className={styles.bVal}>{wk.totalHours.toFixed(3)}</span>
            </div>
            {wk.ptoHours > 0 && (
              <div className={styles.bRow}>
                <span className={styles.bLabel}>
                  PTO <span className={styles.bHint}>(doesn't count toward OT)</span>
                </span>
                <span className={styles.bVal}>{wk.ptoHours.toFixed(3)}</span>
              </div>
            )}
            <div className={styles.bRow}>
              <span className={styles.bLabel}>Worked (non-PTO)</span>
              <span className={styles.bVal}>{wk.workedHours.toFixed(3)}</span>
            </div>
            <div className={styles.bDivider} />
            <div className={styles.bRow}>
              <span className={styles.bLabel}>Regular</span>
              <span className={styles.bVal}>{wk.regularHours.toFixed(3)}</span>
            </div>
            <div className={styles.bRow}>
              <span className={`${styles.bLabel} ${wk.overtimeHours > 0 ? styles.otHighlight : ''}`}>
                Overtime (1.5x)
              </span>
              <span className={`${styles.bVal} ${wk.overtimeHours > 0 ? styles.otHighlight : ''}`}>
                {wk.overtimeHours.toFixed(3)}
              </span>
            </div>
          </div>
        </div>
      ))}

      {/* Combined / single-week totals */}
      <div className={styles.breakdownCard}>
        <div className={styles.sectionTitle}>
          {isMultiWeek ? 'Pay Period Totals' : 'Hours Breakdown'}
        </div>
        <div className={styles.breakdownGrid}>
          <div className={styles.bRow}>
            <span className={styles.bLabel}>Total paid hours</span>
            <span className={styles.bVal}>{totalReported.toFixed(3)}</span>
          </div>
          {totalPto > 0 && (
            <div className={styles.bRow}>
              <span className={styles.bLabel}>
                PTO hours <span className={styles.bHint}>(doesn't count toward OT)</span>
              </span>
              <span className={styles.bVal}>{totalPto.toFixed(3)}</span>
            </div>
          )}
          <div className={styles.bRow}>
            <span className={styles.bLabel}>Worked hours (non-PTO)</span>
            <span className={styles.bVal}>{totalWorked.toFixed(3)}</span>
          </div>
          <div className={styles.bDivider} />
          <div className={styles.bRow}>
            <span className={styles.bLabel}>Regular hours</span>
            <span className={styles.bVal}>{totalRegular.toFixed(3)}</span>
          </div>
          {totalPto > 0 && (
            <div className={styles.bRow}>
              <span className={styles.bLabel}>PTO hours (regular rate)</span>
              <span className={styles.bVal}>{totalPto.toFixed(3)}</span>
            </div>
          )}
          <div className={styles.bRow}>
            <span className={`${styles.bLabel} ${totalOt > 0 ? styles.otHighlight : ''}`}>
              Overtime hours (1.5x)
              {isMultiWeek && <span className={styles.bHint}> — calculated per week</span>}
            </span>
            <span className={`${styles.bVal} ${totalOt > 0 ? styles.otHighlight : ''}`}>
              {totalOt.toFixed(3)}
            </span>
          </div>
        </div>
      </div>

      {/* Pay calculation */}
      {hasRate && (
        <div className={styles.payCard}>
          <div className={styles.sectionTitle}>Estimated Pay</div>
          <div className={styles.payGrid}>
            <div className={styles.payRow}>
              <span className={styles.payLabel}>
                Regular: {totalRegular.toFixed(2)}h x ${rate.toFixed(2)}
              </span>
              <span className={styles.payVal}>${regularPay.toFixed(2)}</span>
            </div>
            {totalPto > 0 && (
              <div className={styles.payRow}>
                <span className={styles.payLabel}>
                  PTO: {totalPto.toFixed(2)}h x ${rate.toFixed(2)}
                </span>
                <span className={styles.payVal}>${ptoPay.toFixed(2)}</span>
              </div>
            )}
            {totalOt > 0 && (
              <div className={styles.payRow}>
                <span className={`${styles.payLabel} ${styles.otHighlight}`}>
                  Overtime: {totalOt.toFixed(2)}h x ${otRate.toFixed(2)}
                </span>
                <span className={`${styles.payVal} ${styles.otHighlight}`}>${otPay.toFixed(2)}</span>
              </div>
            )}
            <div className={styles.payDivider} />
            <div className={styles.payRow}>
              <span className={styles.payLabel}>Hourly subtotal</span>
              <span className={styles.payVal}>${hourlyTotal.toFixed(2)}</span>
            </div>
            {totalBonuses > 0 && (
              <>
                <div className={styles.payRow}>
                  <span className={styles.payLabel} style={{ color: 'var(--green)' }}>
                    Bonuses & commissions
                  </span>
                  <span className={styles.payVal} style={{ color: 'var(--green)' }}>
                    ${totalBonuses.toFixed(2)}
                  </span>
                </div>
                <div className={styles.payDivider} />
              </>
            )}
            <div className={`${styles.payRow} ${styles.payTotal}`}>
              <span className={styles.payLabel}>Estimated gross pay</span>
              <span className={styles.payVal}>${grossPay.toFixed(2)}</span>
            </div>
          </div>
          <div className={styles.payDisclaimer}>
            Estimate based on paid hours (excludes unpaid meal breaks and drive threshold
            deductions). Actual pay may differ due to adjustments or payroll rules.
            {isMultiWeek && ' Overtime is calculated independently per week (40h threshold each).'}
          </div>
        </div>
      )}

      {!hasRate && (
        <div className={styles.emptyState}>
          Enter your hourly rate above to see your estimated paycheck breakdown.
        </div>
      )}
    </div>
  );
}
