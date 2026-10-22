import Button from './Button';
import Icon from './Icon';
import styles from './States.module.css';

// 로딩 · 빈 결과 · 오류(재시도) · 권한 부족 표시
export function Loading({ label = '불러오는 중' }) {
  return (
    <div className={styles.loading} role="status">
      <span className={styles.spinner} aria-hidden="true" />
      {label}
    </div>
  );
}

export function Empty({ title, children, actions }) {
  return (
    <section className={styles.empty}>
      <div className={styles.emptyText}>
        <h2 className={styles.emptyTitle}>{title}</h2>
        {children ? <p className={styles.emptyBody}>{children}</p> : null}
      </div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </section>
  );
}

export function ErrorState({ error, onRetry, title = '불러오지 못했습니다' }) {
  const forbidden = error?.status === 403;
  return (
    <div className={styles.error} role="alert">
      <div className={styles.errorText}>
        <span className={styles.errorTitle}>
          <Icon name={forbidden ? 'lock' : 'warning'} size="md" />
          {forbidden ? '권한이 없습니다' : title}
        </span>
        <span className={styles.errorBody}>{error?.message ?? '잠시 후 다시 시도해 주세요.'}</span>
      </div>
      {onRetry && !forbidden ? (
        <Button variant="secondary" size="lg" onClick={onRetry}>
          다시 시도
        </Button>
      ) : null}
    </div>
  );
}

export function InlineError({ error, children }) {
  const message = children ?? error?.message;
  if (!message) return null;
  return (
    <div className={styles.inline} role="alert">
      {message}
    </div>
  );
}
