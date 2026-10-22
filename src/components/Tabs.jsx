import { useRef } from 'react';
import styles from './Tabs.module.css';

// 시안 "탭": surface-2 바탕 안에 선택 탭만 surface-3(인증 화면은 surface-4)
// items: [{ value, label, disabled }]
export default function Tabs({ items, value, onChange, label, variant = 'default', className = '' }) {
  const refs = useRef([]);
  const enabled = items.filter((t) => !t.disabled);
  const onKeyDown = (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const idx = enabled.findIndex((t) => t.value === value);
    const next = enabled[(idx + (e.key === 'ArrowRight' ? 1 : -1) + enabled.length) % enabled.length];
    if (!next) return;
    onChange(next.value);
    refs.current[items.indexOf(next)]?.focus();
    e.preventDefault();
  };
  return (
    <div role="tablist" aria-label={label} className={`${styles.list} ${styles[variant]} ${className}`} onKeyDown={onKeyDown}>
      {items.map((t, i) => {
        const on = t.value === value;
        return (
          <button
            key={t.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            disabled={t.disabled}
            className={`${styles.tab} ${on ? styles.on : ''}`}
            onClick={() => onChange(t.value)}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
