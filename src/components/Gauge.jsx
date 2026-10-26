import styles from './Gauge.module.css';
import { scoreColor } from '../lib/court';

// 서버 게이지 상태 표시(조작 컨트롤 아님). score 가 없으면 바늘을 그리지 않는다.
// variant: live(진행 중 14px · 트랙) · result(결과 · 목록 12px · 채움)
export default function Gauge({ score, variant = 'live', middle, needleColor, describe = true }) {
  const has = typeof score === 'number';
  const left = has ? Math.max(0, Math.min(100, score)) : 50;
  return (
    <div className={styles.wrap}>
      <div
        className={`${styles.track} ${styles[variant]}`}
        role={describe && has ? 'meter' : undefined}
        aria-valuemin={describe && has ? 0 : undefined}
        aria-valuemax={describe && has ? 100 : undefined}
        aria-valuenow={describe && has ? score : undefined}
        aria-label={describe && has ? '판사 게이지 (0 무죄 · 100 유죄)' : undefined}
      >
        <span className={styles.center} aria-hidden="true" />
        {has ? <span className={styles.needle} style={{ left: `${left}%`, background: needleColor ?? scoreColor(score) }} aria-hidden="true" /> : null}
      </div>
      <div className={styles.scale}>
        <span className={styles.def}>0 무죄</span>
        <span className={styles.mid}>{middle}</span>
        <span className={styles.pro}>유죄 100</span>
      </div>
    </div>
  );
}
