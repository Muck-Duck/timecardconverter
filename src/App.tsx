import { useState, useEffect } from 'react';
import type { TimecardData } from './types';
import { parseTimecardXLSX } from './xlsxParser';
import { validateMerge, mergeTimecards } from './mergeTimecards';
import UploadScreen from './UploadScreen';
import ClassicView from './ClassicView';
import EnhancedView from './EnhancedView';
import InsightsView from './InsightsView';
import CheckEstimator from './CheckEstimator';
import styles from './App.module.css';

type View = 'classic' | 'enhanced' | 'insights' | 'check';

const STORAGE_KEY = 'adt-drive-threshold';
const DEFAULT_THRESHOLD = 45;

export default function App() {
  const [data, setData] = useState<TimecardData | null>(null);
  const [view, setView] = useState<View>('classic');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [driveThreshold, setDriveThreshold] = useState<number>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved !== null ? parseInt(saved) : DEFAULT_THRESHOLD;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(driveThreshold));
  }, [driveThreshold]);

  async function handleFiles(file1: File, file2?: File) {
    setLoading(true);
    setError(undefined);
    try {
      const parsed1 = await parseTimecardXLSX(file1, driveThreshold);

      if (!file2) {
        setData(parsed1);
        return;
      }

      const parsed2 = await parseTimecardXLSX(file2, driveThreshold);

      // Validate
      const validationError = validateMerge(parsed1, parsed2);
      if (validationError) {
        setError(validationError);
        return;
      }

      // Merge
      const merged = mergeTimecards(parsed1, parsed2);
      setData(merged);
    } catch (e) {
      console.error(e);
      setError("Could not parse this file. Make sure it's an ADT timecard XLSX export.");
    } finally {
      setLoading(false);
    }
  }

  if (!data) {
    return (
      <UploadScreen
        onFiles={handleFiles}
        error={error}
        loading={loading}
        driveThreshold={driveThreshold}
        onThresholdChange={setDriveThreshold}
      />
    );
  }

  return (
    <div className={styles.app}>
      {/* Top nav */}
      <nav className={styles.topNav}>
        <div className={styles.navLogo}>
          <span className={styles.navAdt}>ADT</span>
          <span className={styles.navDivider}>//</span>
          <span>TimeCard Viewer</span>
        </div>
        <div className={styles.navRight}>
          <span className={styles.navThreshold}>
            Drive threshold: <strong>{driveThreshold === 0 ? 'Fully Paid' : `${driveThreshold}m`}</strong>
          </span>
          <button className={styles.navReset} onClick={() => setData(null)}>
            Upload New
          </button>
        </div>
      </nav>

      {/* Header */}
      <div className={styles.headerBar}>
        <div className={styles.headerLeft}>
          <div className={styles.headerName}>{data.techName}</div>
          <div className={`${styles.headerPeriod} ${styles.mono}`}>
            {data.periodStart} – {data.periodEnd}
            {data.location && <> &nbsp;·&nbsp; {data.location}</>}
          </div>
        </div>
        <div className={styles.headerBadges}>
          {data.status && (
            <span className={`${styles.badge} ${styles.badgeApproved}`}>
              {data.status.toLowerCase().includes('approv') ? '✓ ' : ''}{data.status}
            </span>
          )}
          <span className={`${styles.badge} ${styles.badgeHours}`}>
            {data.totalCalculatedHours.toFixed(2)} calc hrs
          </span>
          {data.scheduleDeviation > 0 && (
            <span className={`${styles.badge} ${styles.badgeOt}`}>
              +{data.scheduleDeviation.toFixed(2)} OT
            </span>
          )}
        </div>
      </div>

      {/* View switcher */}
      <div className={styles.viewSwitcher}>
        <div
          className={`${styles.viewTab} ${view === 'classic' ? styles.active : ''}`}
          onClick={() => setView('classic')}
        >
          Classic
        </div>
        <div
          className={`${styles.viewTab} ${view === 'enhanced' ? styles.active : ''}`}
          onClick={() => setView('enhanced')}
        >
          Enhanced
        </div>
        <div
          className={`${styles.viewTab} ${view === 'insights' ? styles.active : ''}`}
          onClick={() => setView('insights')}
        >
          Insights
        </div>
        <div
          className={`${styles.viewTab} ${view === 'check' ? styles.active : ''}`}
          onClick={() => setView('check')}
        >
          Check Estimator
        </div>
      </div>

      {/* Content */}
      {view === 'classic' && <ClassicView data={data} />}
      {view === 'enhanced' && <EnhancedView data={data} />}
      {view === 'insights' && <InsightsView data={data} />}
      {view === 'check' && <CheckEstimator data={data} driveThreshold={driveThreshold} />}
    </div>
  );
}
