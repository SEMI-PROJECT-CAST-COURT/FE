import { useRef } from 'react';
import { Link } from 'react-router';
import Icon from './Icon';
import { useTheme } from '../store/theme';
import styles from './Footer.module.css';

const THEMES = [
  { value: 'system', label: '시스템', icon: 'system' },
  { value: 'light', label: '라이트', icon: 'sun' },
  { value: 'dark', label: '다크', icon: 'moon' },
];

export default function Footer() {
  const { pref, contrast, setPref, toggleContrast } = useTheme();
  const refs = useRef([]);
  const onKeyDown = (e) => {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
    const idx = THEMES.findIndex((t) => t.value === pref);
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
    const nextIdx = (idx + step + THEMES.length) % THEMES.length;
    setPref(THEMES[nextIdx].value);
    refs.current[nextIdx]?.focus();
    e.preventDefault();
  };
  const hc = contrast === 'high';
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <span>CAST COURT · 수업 과제·포트폴리오용 비영리 프로젝트</span>
        <div className={styles.right}>
          <div role="radiogroup" aria-label="화면 테마" className={styles.segment} onKeyDown={onKeyDown}>
            {THEMES.map((t, i) => {
              const on = pref === t.value;
              return (
                <button
                  key={t.value}
                  ref={(el) => {
                    refs.current[i] = el;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  tabIndex={on ? 0 : -1}
                  className={`${styles.seg} ${on ? styles.segOn : ''}`}
                  onClick={() => setPref(t.value)}
                >
                  <Icon name={t.icon} size="sm" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
          <button type="button" aria-pressed={hc} onClick={toggleContrast} className={`${styles.hc} ${hc ? styles.hcOn : ''}`}>
            <Icon name="contrast" size="sm" />
            <span>고대비</span>
          </button>
          <nav aria-label="푸터 메뉴" className={styles.links}>
            <Link to="/credits">저작권 · 크레딧</Link>
            <Link to="/rules">재판 규칙</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
