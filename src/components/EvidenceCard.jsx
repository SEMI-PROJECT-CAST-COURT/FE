import Icon from './Icon';
import { roleIcon } from '../lib/court';
import styles from './EvidenceCard.module.css';

// 근거 카드 표시(시안 "근거 카드"). 서버 카드에 출처 필드가 없어 진영 · 가중치만 표시한다.
export default function EvidenceCard({ side, title, body, weight }) {
  const pro = side === 'PROSECUTION';
  return (
    <div className={`${styles.card} ${pro ? styles.pro : styles.def}`}>
      <div className={styles.top}>
        <span className={styles.side}>
          <Icon name={roleIcon(side)} size="sm" />
          {pro ? '검사 측' : '변호 측'}
        </span>
        {typeof weight === 'number' ? <span className={styles.side}>가중치 {weight}</span> : null}
      </div>
      <div className={styles.title}>{title}</div>
      <div className={styles.body}>{body}</div>
    </div>
  );
}
