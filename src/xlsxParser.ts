import * as XLSX from 'xlsx';
import type {
  TimecardData, DayData, TimeSegment, BonusEntry,
  ActivityType, PayType
} from './types';
import { applyDriveTimeRules } from './driveRules';

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseTimeToMinutes(timeStr: string): number {
  const m = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return 0;
  let h = parseInt(m[1]);
  const min = parseInt(m[2]);
  const ampm = m[3].toUpperCase();
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}

function classifyActivity(raw: string): ActivityType {
  const s = raw.toLowerCase().trim();
  if (s.includes('enroute') || s.includes('en route')) return 'enroute';
  if (s.includes('onsite') || s.includes('on site')) return 'onsite';
  if (s.includes('clear')) return 'clear';
  if (s.includes('training')) return 'training';
  if (s.includes('parts')) return 'parts_pickup';
  if (s.includes('lunch') || s.includes('meal')) return 'lunch';
  if (s.includes('arrive') || s.includes('home')) return 'arrive_home';
  if (s.includes('unassigned')) return 'unassigned';
  return 'unknown';
}

function classifyPayType(raw: string): PayType {
  const s = raw.toLowerCase().trim();
  if (s.includes('meal break') || s.includes('lunch')) return 'meal_break';
  if (s.includes('morning drive')) return 'morning_drive';
  if (s.includes('evening drive')) return 'evening_drive';
  if (s.includes('tech upsell')) return 'tech_upsell';
  if (s.includes('productivity bonus')) return 'productivity_bonus';
  if (s.includes('certified trainer')) return 'certified_trainer_bonus';
  if (s.includes('standby')) return 'standby';
  if (s.includes('pto')) return 'pto';
  if (s.includes('regular')) return 'regular';
  return 'unknown';
}

function payTypeLabel(p: PayType): string {
  const map: Record<PayType, string> = {
    regular: 'Regular',
    meal_break: 'Meal Break',
    morning_drive: 'Morning Drive Time',
    evening_drive: 'Evening Drive Time',
    tech_upsell: 'Tech Upsell $',
    productivity_bonus: 'Tech Productivity Bonus $',
    certified_trainer_bonus: 'Certified Trainer Bonus $',
    standby: 'Standby $',
    pto: 'PTO',
    unknown: 'Other',
  };
  return map[p] ?? 'Other';
}

/** Check if a payroll type is a bonus/unit-based entry (not time-based) */
function isBonusPayType(raw: string): boolean {
  const s = raw.toLowerCase().trim();
  return s.includes('bonus') || s.includes('upsell') || s.includes('incentive') || s.includes('premium pay');
}


/** Convert "Sunday, March 01" style header to "03/01/YYYY" using period year */
function parseDayHeader(header: string, year: string): { date: string; dayName: string } | null {
  // Match patterns like "Sunday, March 01" or "Monday, March 02"
  const m = header.match(/^(\w+),\s+(\w+)\s+(\d{1,2})$/);
  if (!m) return null;

  const dayName = m[1];
  const monthName = m[2];
  const dayNum = parseInt(m[3]);

  const months: Record<string, string> = {
    january: '01', february: '02', march: '03', april: '04',
    may: '05', june: '06', july: '07', august: '08',
    september: '09', october: '10', november: '11', december: '12',
  };
  const mm = months[monthName.toLowerCase()];
  if (!mm) return null;

  const dd = String(dayNum).padStart(2, '0');
  return { date: `${mm}/${dd}/${year}`, dayName };
}

interface DayColumnGroup {
  date: string;
  dayName: string;
  startCol: number;
  stopCol: number;
  quantityCol: number;
}

// ─── Main parser ────────────────────────────────────────────────────────────

export async function parseTimecardXLSX(file: File, driveThresholdMinutes = 45): Promise<TimecardData> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  // Get the full range and decode into a 2D array
  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1');
  const rows: (string | number | undefined)[][] = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row: (string | number | undefined)[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[addr];
      row.push(cell ? cell.v : undefined);
    }
    rows.push(row);
  }

  if (rows.length < 3) throw new Error('XLSX has too few rows to be a timecard');

  // ── Row 0: Period header in A1 + day headers ──
  const row0 = rows[0];
  const periodCell = String(row0[0] ?? '');
  const periodMatch = periodCell.match(/(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/);
  const periodStart = periodMatch?.[1] ?? '';
  const periodEnd = periodMatch?.[2] ?? '';
  const year = periodStart.slice(6, 10) || new Date().getFullYear().toString();

  // ── Row 1: Column headers — find day triplet positions ──
  const row1 = rows[1];
  const dayGroups: DayColumnGroup[] = [];

  // Scan row 0 for day headers (they appear after the metadata columns)
  for (let c = 0; c < row0.length; c++) {
    const cellVal = String(row0[c] ?? '').trim();
    const parsed = parseDayHeader(cellVal, year);
    if (parsed) {
      // The 3 columns under this day header are at the same column index
      // Row 1 should have "Start", "Stop", "Quantity" at c, c+1, c+2
      // But we need to verify — the day header may span via merge
      // Find Start/Stop/Quantity in row 1 at or after column c
      let startCol = -1, stopCol = -1, quantityCol = -1;
      for (let sc = c; sc < Math.min(c + 5, row1.length); sc++) {
        const h = String(row1[sc] ?? '').toLowerCase().trim();
        if (h === 'start' && startCol === -1) startCol = sc;
        else if (h === 'stop' && stopCol === -1) stopCol = sc;
        else if (h === 'quantity' && quantityCol === -1) quantityCol = sc;
      }

      if (startCol >= 0 && stopCol >= 0 && quantityCol >= 0) {
        dayGroups.push({
          date: parsed.date,
          dayName: parsed.dayName,
          startCol,
          stopCol,
          quantityCol,
        });
      }
    }
  }

  // ── Parse merged cells to find day header spans ──
  // If no day groups found by scanning row 0, try using merges
  if (dayGroups.length === 0 && sheet['!merges']) {
    for (const merge of sheet['!merges']) {
      if (merge.s.r === 0) {
        const addr = XLSX.utils.encode_cell({ r: 0, c: merge.s.c });
        const cellVal = String(sheet[addr]?.v ?? '').trim();
        const parsed = parseDayHeader(cellVal, year);
        if (parsed) {
          const startCol = merge.s.c;
          dayGroups.push({
            date: parsed.date,
            dayName: parsed.dayName,
            startCol: startCol,
            stopCol: startCol + 1,
            quantityCol: startCol + 2,
          });
        }
      }
    }
  }

  // ── Identify metadata columns from row 1 ──
  let payTypeCol = -1, activityCol = -1, jobNumberCol = -1;
  for (let c = 0; c < row1.length; c++) {
    const h = String(row1[c] ?? '').toLowerCase().trim();
    if (h.includes('payroll') || h.includes('time type')) payTypeCol = c;
    if (h.includes('activity')) activityCol = c;
    if (h.includes('job number')) jobNumberCol = c;
  }

  // Also find "Total" column — check both row 0 and row 1 (may be merged)
  let totalCol = -1;
  for (let c = 0; c < row0.length; c++) {
    if (String(row0[c] ?? '').toLowerCase().trim() === 'total') {
      totalCol = c;
      break;
    }
  }
  if (totalCol < 0) {
    for (let c = 0; c < row1.length; c++) {
      if (String(row1[c] ?? '').toLowerCase().trim() === 'total') {
        totalCol = c;
        break;
      }
    }
  }

  // ── Parse data rows (row index 2+) ──
  const daySegmentsMap = new Map<string, TimeSegment[]>();
  const dayBonusesMap = new Map<string, BonusEntry[]>();
  const dayHoursMap = new Map<string, number>();
  const weeklyBonuses: BonusEntry[] = [];

  // Initialize maps for each day
  for (const dg of dayGroups) {
    daySegmentsMap.set(dg.date, []);
    dayBonusesMap.set(dg.date, []);
    dayHoursMap.set(dg.date, 0);
  }

  for (let r = 2; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every(c => c === undefined || String(c).trim() === '')) continue;

    const payTypeRaw = payTypeCol >= 0 ? String(row[payTypeCol] ?? '').trim() : '';

    // Skip summary/totals rows (empty payroll type = not a real data row)
    if (!payTypeRaw) continue;

    const activityRaw = activityCol >= 0 ? String(row[activityCol] ?? '') : '';
    const jobNumber = jobNumberCol >= 0 ? String(row[jobNumberCol] ?? '').trim() : undefined;
    const cleanJobNumber = jobNumber && jobNumber !== '' && jobNumber !== 'undefined' ? jobNumber : undefined;

    const payType = classifyPayType(payTypeRaw);
    const activity = classifyActivity(activityRaw);

    // Determine if this is a bonus/units row by checking the Total column
    const totalCellVal = totalCol >= 0 ? String(row[totalCol] ?? '').toLowerCase() : '';
    const isUnitsRow = totalCellVal.includes('units') || isBonusPayType(payTypeRaw);

    // For unknown pay types, use the raw cell B value as the label
    const bonusLabel = payType === 'unknown' ? payTypeRaw : payTypeLabel(payType);

    // Tech Upsell stays on the day (job-specific). All other bonuses are weekly.
    const isDayBonus = payType === 'tech_upsell';

    // Check each day's columns for data
    for (const dg of dayGroups) {
      const startVal = row[dg.startCol];
      const stopVal = row[dg.stopCol];
      const qtyVal = row[dg.quantityCol];

      // Skip if no data for this day
      if (startVal === undefined && stopVal === undefined && (qtyVal === undefined || qtyVal === 0)) {
        continue;
      }

      // Skip if quantity is a string like "3 hours" (summary cell, not real data)
      if (typeof qtyVal === 'string' && /hours|units/i.test(qtyVal)) continue;

      const startTime = String(startVal ?? '').trim();
      const endTime = String(stopVal ?? '').trim();
      const quantity = typeof qtyVal === 'number' ? qtyVal : parseFloat(String(qtyVal ?? '0'));

      if (!startTime && !endTime && quantity === 0) continue;

      if (!daySegmentsMap.has(dg.date)) {
        daySegmentsMap.set(dg.date, []);
        dayBonusesMap.set(dg.date, []);
        dayHoursMap.set(dg.date, 0);
      }

      // If this is a units/bonus row or has no start/stop times, treat as bonus
      if (isUnitsRow || (!startTime && !endTime)) {
        const bonus: BonusEntry = {
          payType,
          label: bonusLabel,
          units: quantity,
          jobNumber: cleanJobNumber,
        };

        // Productivity bonus covers a 2-week period
        if (payType === 'productivity_bonus') {
          bonus.note = 'Covers this week + prior week';
        }

        if (isDayBonus) {
          dayBonusesMap.get(dg.date)!.push(bonus);
        } else {
          weeklyBonuses.push(bonus);
        }
        continue;
      }

      const startMinutes = parseTimeToMinutes(startTime);
      const endMinutes = parseTimeToMinutes(endTime);

      daySegmentsMap.get(dg.date)!.push({
        startTime,
        endTime,
        startMinutes,
        endMinutes,
        durationHours: quantity,
        activity,
        payType,
        jobNumber: cleanJobNumber,
        unpaidMinutes: 0,
        paidMinutes: Math.round(endMinutes - startMinutes),
      });
      dayHoursMap.set(dg.date, (dayHoursMap.get(dg.date) ?? 0) + quantity);
    }
  }

  // ── Build DayData for each day ──
  const days: DayData[] = [];
  for (const dg of dayGroups) {
    const rawSegments = daySegmentsMap.get(dg.date) ?? [];
    const bonuses = dayBonusesMap.get(dg.date) ?? [];
    if (rawSegments.length === 0 && bonuses.length === 0) continue;

    // Sort segments by start time, then by end time for 0-duration markers
    rawSegments.sort((a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes);

    // Insert synthetic "unassigned" segments for gaps between segments
    const withGaps: TimeSegment[] = [];
    for (let i = 0; i < rawSegments.length; i++) {
      const seg = rawSegments[i];
      if (withGaps.length > 0) {
        const prev = withGaps[withGaps.length - 1];
        const gapStart = prev.endMinutes;
        const gapEnd = seg.startMinutes;
        if (gapEnd > gapStart) {
          const gapMins = gapEnd - gapStart;
          withGaps.push({
            startTime: prev.endTime,
            endTime: seg.startTime,
            startMinutes: gapStart,
            endMinutes: gapEnd,
            durationHours: +(gapMins / 60).toFixed(3),
            activity: 'unassigned',
            payType: 'regular',
            unpaidMinutes: 0,
            paidMinutes: gapMins,
            isGap: true,
          });
        }
      }
      withGaps.push(seg);
    }

    const processedSegments = applyDriveTimeRules(withGaps, driveThresholdMinutes);

    const reportedHours = dayHoursMap.get(dg.date) ?? 0;

    const workSegments = processedSegments.filter(s =>
      s.activity !== 'clear' && s.durationHours > 0
    );
    const firstIn = workSegments[0]?.startTime ?? null;
    const lastOut = workSegments[workSegments.length - 1]?.endTime ?? null;

    const lunchSeg = processedSegments.find(s =>
      s.activity === 'lunch' || s.payType === 'meal_break'
    );
    const lunchBreak = lunchSeg
      ? { start: lunchSeg.startTime, end: lunchSeg.endTime }
      : null;

    const jobNums = new Set(processedSegments
      .filter(s => s.jobNumber && s.activity === 'onsite')
      .map(s => s.jobNumber!)
    );

    const unpaidMins = processedSegments.reduce((sum, s) => sum + (s.unpaidMinutes ?? 0), 0);

    days.push({
      date: dg.date,
      dayName: dg.dayName,
      shortDate: dg.date.slice(0, 5),
      segments: processedSegments,
      bonuses,
      reportedHours,
      calculatedHours: reportedHours,
      firstIn,
      lastOut,
      lunchBreak,
      jobCount: jobNums.size,
      hasUnpaidDrive: unpaidMins > 0,
      unpaidDriveMinutes: unpaidMins,
      isWorked: reportedHours > 0,
    });
  }

  // ── Compute totals ──
  const totalReportedHours = days.reduce((sum, d) => sum + d.reportedHours, 0);

  return {
    techName: '',
    personNumber: '',
    periodStart,
    periodEnd,
    manager: '',
    jobTitle: '',
    location: '',
    department: '',
    status: '',
    totalReportedHours,
    totalCalculatedHours: totalReportedHours,
    scheduledHours: 0,
    scheduleDeviation: 0,
    totalRegularHours: totalReportedHours,
    totalCommissions: 0,
    days,
    weeklyBonuses,
  };
}
