export type ActivityType =
  | 'enroute'
  | 'onsite'
  | 'clear'
  | 'training'
  | 'parts_pickup'
  | 'lunch'
  | 'arrive_home'
  | 'unassigned'
  | 'unknown';

export type PayType =
  | 'regular'
  | 'meal_break'
  | 'morning_drive'
  | 'evening_drive'
  | 'tech_upsell'
  | 'productivity_bonus'
  | 'certified_trainer_bonus'
  | 'standby'
  | 'pto'
  | 'unknown';

export interface TimeSegment {
  startTime: string;       // "7:31 AM"
  endTime: string;         // "9:25 AM"
  startMinutes: number;    // minutes from midnight
  endMinutes: number;
  durationHours: number;
  activity: ActivityType;
  payType: PayType;
  jobNumber?: string;
  // Drive time pay logic
  isFirstDrive?: boolean;
  isLastDrive?: boolean;
  unpaidMinutes?: number;   // 0-45
  paidMinutes?: number;
  isGap?: boolean;          // synthetic segment filling a gap in the timeline
}

export interface BonusEntry {
  payType: PayType;
  label: string;
  units: number;
  jobNumber?: string;
  note?: string;             // e.g. "Covers this week + prior week"
}

export interface DayData {
  date: string;            // "03/10/2026"
  dayName: string;         // "Monday"
  shortDate: string;       // "03/10"
  segments: TimeSegment[];
  bonuses: BonusEntry[];
  reportedHours: number;
  calculatedHours: number;
  firstIn: string | null;
  lastOut: string | null;
  lunchBreak: { start: string; end: string } | null;
  jobCount: number;
  hasUnpaidDrive: boolean;
  unpaidDriveMinutes: number;
  isWorked: boolean;
}

export interface TimecardData {
  techName: string;
  personNumber: string;
  periodStart: string;
  periodEnd: string;
  manager: string;
  jobTitle: string;
  location: string;
  department: string;
  status: string;
  totalReportedHours: number;
  totalCalculatedHours: number;
  scheduledHours: number;
  scheduleDeviation: number;
  totalRegularHours: number;
  totalCommissions: number;
  days: DayData[];
  weeklyBonuses: BonusEntry[];
}
