import React, { useCallback, useState } from 'react';
import styles from './UploadScreen.module.css';

interface Props {
  onFiles: (file1: File, file2?: File) => void;
  error?: string;
  loading?: boolean;
  driveThreshold: number;
  onThresholdChange: (val: number) => void;
}

const PRESETS = [
  { label: 'Fully Paid', value: 0 },
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
];

function isXlsx(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith('.xlsx') || name.endsWith('.xls');
}

export default function UploadScreen({ onFiles, error, loading, driveThreshold, onThresholdChange }: Props) {
  const [dragging1, setDragging1] = useState(false);
  const [dragging2, setDragging2] = useState(false);
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);

  const handleDrop1 = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging1(false);
    const file = e.dataTransfer.files[0];
    if (file && isXlsx(file)) setFile1(file);
  }, []);

  const handleDrop2 = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging2(false);
    const file = e.dataTransfer.files[0];
    if (file && isXlsx(file)) setFile2(file);
  }, []);

  const handleInput1 = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && isXlsx(file)) setFile1(file);
  };

  const handleInput2 = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && isXlsx(file)) setFile2(file);
  };

  const handleSubmit = () => {
    if (!file1) return;
    onFiles(file1, file2 ?? undefined);
  };

  return (
    <div className={styles.screen}>
      <div className={styles.inner}>
        <div className={styles.logo}>
          <span className={styles.logoAdt}>ADT</span>
          <span className={styles.logoDivider}>//</span>
          <span className={styles.logoText}>TimeCard Viewer</span>
        </div>

        <p className={styles.tagline}>
          Upload your exported timecard XLSX for a clear, readable breakdown
          of your hours, pay codes, and drive-time calculations.
        </p>

        {/* Drive threshold setting */}
        <div className={styles.settingsBox}>
          <div className={styles.settingsLabel}>
            Unpaid drive threshold
            <span className={styles.settingsHint}>
              First & last drive of day — only time over this is paid
            </span>
          </div>
          <div className={styles.presets}>
            {PRESETS.map(p => (
              <button
                key={p.value}
                className={`${styles.presetBtn} ${driveThreshold === p.value ? styles.presetActive : ''}`}
                onClick={() => onThresholdChange(p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className={styles.customRow}>
            <span className={styles.customLabel}>Custom:</span>
            <input
              type="number"
              min={0}
              max={120}
              value={driveThreshold}
              onChange={e => onThresholdChange(Math.max(0, parseInt(e.target.value) || 0))}
              className={`${styles.customInput} ${styles.mono}`}
            />
            <span className={styles.customUnit}>minutes</span>
          </div>
        </div>

        {/* Drop zones */}
        <div className={styles.dropRow}>
          {/* Week 1 — required */}
          <label
            className={`${styles.dropzone} ${dragging1 ? styles.dragging : ''} ${file1 ? styles.hasFile : ''} ${error && !file1 ? styles.hasError : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragging1(true); }}
            onDragLeave={() => setDragging1(false)}
            onDrop={handleDrop1}
          >
            <input
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className={styles.fileInput}
              onChange={handleInput1}
              disabled={loading}
            />
            {file1 ? (
              <>
                <div className={styles.dzCheckIcon}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 6L9 17l-5-5"/>
                  </svg>
                </div>
                <div className={styles.dzLabel}>{file1.name}</div>
                <div className={styles.dzSub}>Click or drop to replace</div>
              </>
            ) : (
              <>
                <div className={styles.dzIcon}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="12" y1="18" x2="12" y2="12"/>
                    <line x1="9" y1="15" x2="15" y2="15"/>
                  </svg>
                </div>
                <div className={styles.dzLabel}>
                  {dragging1 ? 'Drop it here' : 'Week 1'}
                </div>
                <div className={styles.dzSub}>Drop your XLSX here</div>
              </>
            )}
          </label>

          {/* Week 2 — optional */}
          <label
            className={`${styles.dropzone} ${styles.dropzoneOptional} ${dragging2 ? styles.dragging : ''} ${file2 ? styles.hasFile : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragging2(true); }}
            onDragLeave={() => setDragging2(false)}
            onDrop={handleDrop2}
          >
            <input
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className={styles.fileInput}
              onChange={handleInput2}
              disabled={loading}
            />
            {file2 ? (
              <>
                <div className={styles.dzCheckIcon}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 6L9 17l-5-5"/>
                  </svg>
                </div>
                <div className={styles.dzLabel}>{file2.name}</div>
                <div className={styles.dzSub}>Click or drop to replace</div>
              </>
            ) : (
              <>
                <div className={styles.dzIcon}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="12" y1="18" x2="12" y2="12"/>
                    <line x1="9" y1="15" x2="15" y2="15"/>
                  </svg>
                </div>
                <div className={styles.dzLabel}>
                  {dragging2 ? 'Drop it here' : 'Week 2'}
                </div>
                <div className={styles.dzSub}>Optional — combine into full pay period</div>
              </>
            )}
          </label>
        </div>

        {/* Submit */}
        {file1 && (
          <button
            className={styles.submitBtn}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <>
                <div className={styles.spinnerSmall} />
                Parsing…
              </>
            ) : (
              file2 ? 'View Combined Pay Period' : 'View Timecard'
            )}
          </button>
        )}

        {file2 && !file1 && (
          <div className={styles.hint}>Drop your Week 1 file to continue</div>
        )}

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.privacy}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          Your data never leaves your browser. All processing is done locally.
        </div>
      </div>
    </div>
  );
}
