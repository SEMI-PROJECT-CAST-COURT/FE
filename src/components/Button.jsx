import { Link } from 'react-router';
import styles from './Button.module.css';

// variant: primary(주요) · secondary(보조) · danger(위험) · dangerOutline · text · admin
// size: default(42) · sm(34) · md(36) · lg(40) · xl(44) · cta(48)
export default function Button({ variant = 'primary', size = 'default', to, className = '', loading = false, children, type = 'button', disabled, block, ...rest }) {
  const cls = [styles.btn, styles[variant], styles[size], block ? styles.block : '', className].filter(Boolean).join(' ');
  if (to && !disabled) {
    return (
      <Link to={to} className={cls} {...rest}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <span className={styles.spinner} aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
