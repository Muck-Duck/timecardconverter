import type { TimecardData, DayData, PayType } from './types';
import styles from './ClassicView.module.css';

interface Props {
  data: TimecardData;
}

function payCodeLabel(p: PayType): string {
  const map: Record<PayType, string> = {
    regular: 'Regular',
    meal_break: 'Meal Break',
    morning_drive: 'Morning Drive Time',
    evening_drive: 'Evening Drive Time',
    tech_upsell: 'Tech Upsell $',
    productivity_bonus: 'Productivity Bonus $',
    certified_trainer_bonus: 'Cert Trainer Bonus $',
    standby: 'Standby $',
    pto: 'PTO',
    unknown: 'Other',
  };
  return map[p] ?? 'Other';
}

function payCodeVariant(p: PayType): string {
  if (['tech_upsell', 'productivity_bonus', 'certified_trainer_bonus', 'standby'].includes(p)) return 'green';
  if (['morning_drive', 'evening_drive'].includes(p)) return 'amber';
  if (p === 'pto') return 'blue';
  return 'default';
}

function formatHours(h: number): string {
  if (h === 0) return '—';
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  if (hrs === 0) return `0:${mins.toString().padStart(2, '0')}`;
  return `${hrs}:${mins.toString().padStart(2, '0')}`;
}

function DayRows({ day }: { day: DayData }) {
  const rows: React.ReactNode[] = [];

  // Bonus rows first
  day.bonuses.forEach((b, i) => {
    rows.push(
      <tr key={`bonus-${i}`} className={styles.row}>
        <td className={styles.tdDate}>{i === 0 ? `${day.dayName.slice(0, 3)} ${day.shortDate}` : ''}</td>
        <td className={styles.tdPaycode}>
          <span className={`${styles.pill} ${styles[payCodeVariant(b.payType)]}`}>
            {b.label || payCodeLabel(b.payType)}
          </span>
        </td>
        <td className={`${styles.tdAmount} ${styles.mono}`}>
          {b.units > 0 ? `$${b.units.toFixed(2)}` : '—'}
        </td>
        <td className={styles.tdTime}>—</td>
        <td className={styles.tdTime}>—</td>
        <td className={`${styles.tdHours} ${styles.mono}`}>—</td>
      </tr>
    );
  });

  // Time segments — group into punches
  // Find first-in and last-out, show lunch as its own row
  if (day.isWorked && day.segments.length > 0) {
    const hasBonus = day.bonuses.length > 0;
    const dateLabel = !hasBonus ? `${day.dayName.slice(0, 3)} ${day.shortDate}` : '';

    // Build punch rows: pre-lunch block, lunch, post-lunch block
    const lunchIdx = day.segments.findIndex(
      s => s.activity === 'lunch' || s.payType === 'meal_break'
    );

    if (lunchIdx > 0) {
      const preLunch = day.segments.slice(0, lunchIdx);
      const postLunch = day.segments.slice(lunchIdx + 1);
      const lunch = day.segments[lunchIdx];
      const preLunchIn = preLunch[0]?.startTime ?? '—';
      const preLunchOut = preLunch[preLunch.length - 1]?.endTime ?? '—';
      const postLunchIn = postLunch[0]?.startTime ?? '—';
      const postLunchOut = postLunch[postLunch.length - 1]?.endTime ?? '—';

      rows.push(
        <tr key="pre" className={styles.row}>
          <td className={styles.tdDate}>{!hasBonus ? dateLabel : ''}</td>
          <td className={styles.tdPaycode}>Regular</td>
          <td className={styles.tdAmount}></td>
          <td className={`${styles.tdTime} ${styles.mono}`}>{preLunchIn}</td>
          <td className={`${styles.tdTime} ${styles.mono}`}>{preLunchOut}</td>
          <td className={`${styles.tdHours} ${styles.mono}`}></td>
        </tr>
      );
      rows.push(
        <tr key="lunch" className={styles.row}>
          <td className={styles.tdDate}></td>
          <td className={styles.tdPaycode}>
            <span className={`${styles.pill} ${styles.default}`}>Meal Break</span>
          </td>
          <td className={styles.tdAmount}></td>
          <td className={`${styles.tdTime} ${styles.mono}`}>{lunch.startTime}</td>
          <td className={`${styles.tdTime} ${styles.mono}`}>{lunch.endTime}</td>
          <td className={`${styles.tdHours} ${styles.mono}`}></td>
        </tr>
      );
      if (postLunch.length > 0) {
        rows.push(
          <tr key="post" className={styles.row}>
            <td className={styles.tdDate}></td>
            <td className={styles.tdPaycode}>Regular</td>
            <td className={styles.tdAmount}></td>
            <td className={`${styles.tdTime} ${styles.mono}`}>{postLunchIn}</td>
            <td className={`${styles.tdTime} ${styles.mono}`}>{postLunchOut}</td>
            <td className={`${styles.tdHours} ${styles.mono}`}></td>
          </tr>
        );
      }
    } else {
      // Single block
      const firstIn = day.firstIn ?? '—';
      const lastOut = day.lastOut ?? '—';
      rows.push(
        <tr key="main" className={styles.row}>
          <td className={styles.tdDate}>{dateLabel}</td>
          <td className={styles.tdPaycode}>Regular</td>
          <td className={styles.tdAmount}></td>
          <td className={`${styles.tdTime} ${styles.mono}`}>{firstIn}</td>
          <td className={`${styles.tdTime} ${styles.mono}`}>{lastOut}</td>
          <td className={`${styles.tdHours} ${styles.mono}`}></td>
        </tr>
      );
    }

    // Evening drive time row if present
    const eveDrive = day.segments.find(s => s.payType === 'evening_drive');
    if (eveDrive) {
      rows.push(
        <tr key="eve" className={styles.row}>
          <td className={styles.tdDate}></td>
          <td className={styles.tdPaycode}>
            <span className={`${styles.pill} ${styles.amber}`}>Eve Drive Time</span>
          </td>
          <td className={styles.tdAmount}></td>
          <td className={`${styles.tdTime} ${styles.mono}`}>{eveDrive.startTime}</td>
          <td className={styles.tdTime}></td>
          <td className={`${styles.tdHours} ${styles.mono}`}>{formatHours(eveDrive.durationHours)}</td>
        </tr>
      );
    }
  }

  // Unpaid drive warning
  if (day.hasUnpaidDrive) {
    rows.push(
      <tr key="unpaid-note" className={styles.unpaidNoteRow}>
        <td></td>
        <td colSpan={5}>
          <span className={styles.unpaidNote}>
            ⚠ {day.unpaidDriveMinutes}min unpaid drive time (45-min rule)
          </span>
        </td>
      </tr>
    );
  }

  // Day total
  if (day.reportedHours > 0) {
    rows.push(
      <tr key="total" className={styles.totalRow}>
        <td></td>
        <td colSpan={4} className={styles.totalLabel}>Daily total</td>
        <td className={`${styles.tdHours} ${styles.mono} ${styles.totalVal}`}>
          {formatHours(day.reportedHours)}
        </td>
      </tr>
    );
  }

  return <>{rows}</>;
}

export default function ClassicView({ data }: Props) {
  const totalHoursDisplay = formatHours(data.totalReportedHours);
  const calcHoursDisplay = formatHours(data.totalCalculatedHours);

  return (
    <div className={styles.container}>
      <div className={styles.weekBlock}>
        <div className={styles.weekLabel}>
          Week of {data.periodStart} – {data.periodEnd}
        </div>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Pay Code</th>
              <th>Amount</th>
              <th>In</th>
              <th>Out</th>
              <th>Hours</th>
            </tr>
          </thead>
          <tbody>
            {data.days.map(day => (
              <DayRows key={day.date} day={day} />
            ))}
            <tr className={styles.cumulativeRow}>
              <td colSpan={5}>Cumulative Hours</td>
              <td className={`${styles.cumulativeVal} ${styles.mono}`}>
                {totalHoursDisplay}
                {data.totalCalculatedHours !== data.totalReportedHours && (
                  <div className={styles.calcSub}>
                    {calcHoursDisplay} calc
                  </div>
                )}
              </td>
            </tr>
          </tbody>
        </table>

        {data.weeklyBonuses.length > 0 && (
          <div className={styles.weeklyBonusBlock}>
            <div className={styles.weeklyBonusLabel}>Weekly Bonuses</div>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Pay Code</th>
                  <th>Amount</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {data.weeklyBonuses.map((b, i) => (
                  <tr key={i} className={styles.row}>
                    <td className={styles.tdPaycode}>
                      <span className={`${styles.pill} ${styles[payCodeVariant(b.payType)]}`}>
                        {b.label || payCodeLabel(b.payType)}
                      </span>
                    </td>
                    <td className={`${styles.tdAmount} ${styles.mono}`}>
                      ${b.units.toFixed(2)}
                    </td>
                    <td className={styles.tdNote}>
                      {b.note ?? ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
