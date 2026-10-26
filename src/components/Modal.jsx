import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import styles from './Modal.module.css';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// 확인 팝업: 열릴 때 안으로 포커스 이동 · Tab 순환 · Esc 닫기 · 닫힐 때 원래 위치로 포커스 복귀
export default function Modal({ open, title, tone = 'default', onClose, children, actions, width = 420, busy = false }) {
  const boxRef = useRef(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const box = boxRef.current;
    const first = box?.querySelector('[data-autofocus]') ?? box?.querySelector(FOCUSABLE);
    (first ?? box)?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) {
        e.stopPropagation();
        closeRef.current?.();
        return;
      }
      if (e.key !== 'Tab' || !box) return;
      const items = Array.from(box.querySelectorAll(FOCUSABLE));
      if (items.length === 0) return;
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstItem) {
        lastItem.focus();
        e.preventDefault();
      } else if (!e.shiftKey && document.activeElement === lastItem) {
        firstItem.focus();
        e.preventDefault();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      if (previous && typeof previous.focus === 'function') previous.focus();
    };
  }, [open, busy]);

  if (!open) return null;
  return createPortal(
    <div className={styles.overlay}>
      <div ref={boxRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className={`${styles.box} ${tone === 'danger' ? styles.danger : ''}`} style={{ maxWidth: width }}>
        <h2 id={titleId} className={`${styles.title} ${tone === 'danger' ? styles.titleDanger : ''}`}>
          {title}
        </h2>
        {children}
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
