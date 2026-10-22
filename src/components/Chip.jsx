import styles from './Chip.module.css';

// 필터 칩(선택 = primary 바탕). size: lg(목록 40) · md(34) · sm(32)
export default function Chip({ pressed, onClick, children, size = 'md' }) {
  return (
    <button type="button" aria-pressed={pressed} onClick={onClick} className={`${styles.chip} ${styles[size]} ${pressed ? styles.on : ''}`}>
      {children}
    </button>
  );
}
