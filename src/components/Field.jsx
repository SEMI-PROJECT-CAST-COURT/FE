import { useId } from 'react';
import styles from './Field.module.css';

// 라벨 + 입력 + 도움말/오류 + 글자 수. children 은 (id, describedBy, invalid) 를 받는 함수 또는 요소.
export default function Field({ label, labelColor, hint, error, count, max, className = '', children, hideLabel }) {
  const id = useId();
  const hintId = `${id}-hint`;
  const over = max !== undefined && count !== undefined && count > max;
  const describedBy = hint || error || max !== undefined ? hintId : undefined;
  const control = typeof children === 'function' ? children({ id, describedBy, invalid: !!error || over }) : children;
  return (
    <div className={`${styles.field} ${className}`}>
      <label htmlFor={id} className={hideLabel ? 'sr-only' : styles.label} style={labelColor ? { color: labelColor } : undefined}>
        <span>{label}</span>
        {max !== undefined && count !== undefined ? (
          <span className={over ? styles.over : styles.counter}>
            {count} / {max}자
          </span>
        ) : null}
      </label>
      {control}
      {error || hint ? (
        <span id={hintId} className={error ? styles.error : styles.hint} role={error ? 'alert' : undefined}>
          {error || hint}
        </span>
      ) : null}
    </div>
  );
}

export function Input({ invalid, className = '', size, ...rest }) {
  return <input className={`${styles.control} ${size === 'lg' ? styles.lg : ''} ${invalid ? styles.invalid : ''} ${className}`} aria-invalid={invalid || undefined} {...rest} />;
}

export function TextArea({ invalid, className = '', ...rest }) {
  return <textarea className={`${styles.control} ${styles.area} ${invalid ? styles.invalid : ''} ${className}`} aria-invalid={invalid || undefined} {...rest} />;
}

export function Select({ invalid, className = '', children, ...rest }) {
  return (
    <select className={`${styles.control} ${invalid ? styles.invalid : ''} ${className}`} aria-invalid={invalid || undefined} {...rest}>
      {children}
    </select>
  );
}
