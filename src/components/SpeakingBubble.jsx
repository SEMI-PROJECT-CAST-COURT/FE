import Icon from './Icon';
import { GRADE, ROLE_NAME, formatDelta, roleIcon } from '../lib/court';
import styles from './SpeakingBubble.module.css';

const CHECK_NAMES = [
  ['issue', '① 쟁점'],
  ['evidence', '② 근거'],
  ['rebut', '③ 반박'],
  ['novel', '④ 새로움'],
];

// 판정 4항목 칩: true ✓ / false ✗ / null(반박 판정 제외) 제외 · 아이콘과 글자를 함께 표시
export function CheckChips({ checks }) {
  if (!checks || typeof checks !== 'object') return null;
  return CHECK_NAMES.map(([key, name]) => {
    if (!(key in checks)) return null;
    const v = checks[key];
    const state = v === true ? 'yes' : v === false ? 'no' : 'skip';
    return (
      <span key={key} className={`${styles.chip} ${styles[state]}`}>
        {name}
        <Icon name={state === 'yes' ? 'check' : state === 'no' ? 'x' : 'minus'} size="12px" />
        <span className="sr-only">{state === 'yes' ? '충족' : state === 'no' ? '미충족' : '판정 제외'}</span>
        {state === 'skip' ? <span aria-hidden="true">제외</span> : null}
      </span>
    );
  });
}

// 판정 줄: 공개된 값만 그린다(숨긴 값을 0/false 로 채우지 않음)
export function JudgeLine({ judge, align = 'start' }) {
  if (!judge) return null;
  const hasChecks = judge.checks && Object.keys(judge.checks).length > 0;
  const grade = judge.grade ? GRADE[judge.grade] : null;
  const hasDelta = typeof judge.delta === 'number';
  if (!hasChecks && !grade && !hasDelta) return null;
  return (
    <div className={`${styles.judge} ${align === 'end' ? styles.end : ''}`}>
      {hasChecks ? <CheckChips checks={judge.checks} /> : null}
      {grade ? (
        <span className={styles.grade} style={{ background: grade.color }}>
          {grade.name}
        </span>
      ) : null}
      {hasDelta ? (
        <span className={styles.delta} style={{ color: judge.delta > 0 ? 'var(--pro)' : judge.delta < 0 ? 'var(--def)' : 'var(--text-3)' }}>
          {formatDelta(judge.delta)}
          {typeof judge.scoreAfter === 'number' ? ` → ${judge.scoreAfter}` : ''}
        </span>
      ) : null}
    </div>
  );
}

// 발언 말풍선: 내 발언은 오른쪽(mine-bubble), 상대는 왼쪽(surface-3)
export default function SpeakingBubble({ side, mine, text, streaming, children }) {
  const pro = side === 'PROSECUTION';
  return (
    <div className={`${styles.wrap} ${mine ? styles.mine : ''}`}>
      <div className={styles.head}>
        <span className={`${styles.avatar} ${pro ? styles.avatarPro : styles.avatarDef}`}>
          <Icon name={roleIcon(side)} size="15px" />
        </span>
        <span className={styles.who} style={{ color: pro ? 'var(--pro)' : 'var(--def)' }}>
          {mine ? '나' : 'AI'} · {ROLE_NAME[side]}
          {streaming ? ' · 작성 중' : ''}
        </span>
      </div>
      <div className={`${styles.bubble} ${mine ? styles.bubbleMine : ''}`}>
        {text}
        {streaming ? (
          <span className={styles.caret} aria-hidden="true">
            ▍
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}
