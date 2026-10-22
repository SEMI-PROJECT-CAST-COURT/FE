import styles from './Pagination.module.css';

// 페이지 번호 10개씩 표시 · page 는 1부터
export default function Pagination({ page, totalPages, onChange }) {
  if (!totalPages || totalPages < 1) return null;
  const blockStart = Math.floor((page - 1) / 10) * 10 + 1;
  const blockEnd = Math.min(totalPages, blockStart + 9);
  const pages = [];
  for (let n = blockStart; n <= blockEnd; n += 1) pages.push(n);
  return (
    <nav aria-label="페이지" className={styles.nav}>
      <button type="button" className={`${styles.btn} ${styles.arrow}`} onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="이전 페이지">
        ‹
      </button>
      {pages.map((n) => (
        <button key={n} type="button" className={`${styles.btn} ${n === page ? styles.on : ''}`} aria-current={n === page ? 'page' : undefined} onClick={() => onChange(n)}>
          {n}
        </button>
      ))}
      <button type="button" className={`${styles.btn} ${styles.arrow}`} onClick={() => onChange(page + 1)} disabled={page >= totalPages} aria-label="다음 페이지">
        ›
      </button>
    </nav>
  );
}
