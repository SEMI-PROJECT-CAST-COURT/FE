import Icon from './Icon';
import { ROLE_NAME, roleIcon } from '../lib/court';
import styles from './RoleBadge.module.css';

// 역할 배지: 아이콘 + 글자 (색만으로 구분하지 않음)
export default function RoleBadge({ role, label }) {
  const tone = role === 'PROSECUTION' ? styles.pro : role === 'DEFENSE' ? styles.def : styles.judge;
  return (
    <span className={`${styles.badge} ${tone}`}>
      <Icon name={roleIcon(role)} size="sm" />
      {label ?? ROLE_NAME[role] ?? '판사'}
    </span>
  );
}

// 결과 · 난이도 · 관리자 배지
export function Badge({ tone = 'neutral', icon, children }) {
  return (
    <span className={`${styles.badge} ${styles[tone]}`}>
      {icon ? <Icon name={icon} size="sm" /> : null}
      {children}
    </span>
  );
}
