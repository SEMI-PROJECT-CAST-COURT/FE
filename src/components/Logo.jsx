import Icon from './Icon';
import styles from './Logo.module.css';

// 저울 아이콘 + 워드마크 · 아이콘 색은 --def
export default function Logo({ size = 'header' }) {
  return (
    <span className={`${styles.logo} ${styles[size]}`}>
      <Icon name="scale" size={size === 'auth' ? '32px' : 'logo'} className={styles.mark} />
      <span className={styles.word}>CAST COURT</span>
    </span>
  );
}
