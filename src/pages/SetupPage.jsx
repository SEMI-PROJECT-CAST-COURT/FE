import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Page } from '../components/Layout';
import Button from '../components/Button';
import Icon from '../components/Icon';
import { ErrorState, InlineError, Loading } from '../components/States';
import { fetchCaseSetup } from '../api/cases';
import { fetchWork } from '../api/works';
import { startTrial } from '../api/trials';
import { putTrialHandoff } from '../store/trialHandoff';
import { DIFFICULTY_COLOR, DIFFICULTY_NAME, MODE_NAME, ROLE_NAME, TIER_RANGES, TIER_TITLES, isWinName, resultName, roleIcon, tierColor } from '../lib/court';
import styles from './SetupPage.module.css';

const MODE_INFO = [
  { mode: 'CHICKEN', gauge: '공개', judge: '①~④ · 등급 · 변화량', cards: '현재 논점의 내 쪽 카드만', prog: '비공개' },
  { mode: 'CHALLENGER', gauge: '공개', judge: '변화량만', cards: '비공개', prog: '공개' },
  { mode: 'IRON', gauge: '비공개', judge: '비공개', cards: '비공개', prog: '비공개' },
];

const ROLE_GOAL = { DEFENSE: '목표 · 게이지 0(무죄) 쪽', PROSECUTION: '목표 · 게이지 100(유죄) 쪽' };
const openColor = (v) => (v === '비공개' ? 'var(--text-3)' : 'var(--win)');

export default function SetupPage() {
  const { workId, caseId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const setup = useQuery({ queryKey: ['setup', caseId], queryFn: () => fetchCaseSetup(caseId) });
  const work = useQuery({ queryKey: ['work', workId], queryFn: () => fetchWork(workId) });
  const [pickedRole, setPickedRole] = useState(null);
  const [mode, setMode] = useState('CHALLENGER');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(null);

  if (setup.isPending) return <Page width="content"><Loading /></Page>;
  if (setup.isError) {
    return (
      <Page width="content">
        <Link to={`/works/${workId}`} className={styles.back}>
          ← 작품으로
        </Link>
        <ErrorState error={setup.error} onRetry={setup.error.status === 404 ? undefined : () => setup.refetch()} />
      </Page>
    );
  }

  const { case: info, roles, penalties } = setup.data;
  const recorded = { DEFENSE: !!roles.def?.recorded, PROSECUTION: !!roles.pro?.recorded };
  const both = recorded.DEFENSE && recorded.PROSECUTION;
  // 기록이 있는 역할은 고를 수 없다(서버도 409 ROLE_ALREADY_RECORDED)
  const role = pickedRole && !recorded[pickedRole] ? pickedRole : !recorded.DEFENSE ? 'DEFENSE' : !recorded.PROSECUTION ? 'PROSECUTION' : null;
  const sentenceOf = (tier) => penalties.find((p) => p.tier === tier)?.sentence ?? '';

  const start = async () => {
    if (!role || starting) return;
    setStarting(true);
    setError(null);
    try {
      const result = await startTrial({ caseId: Number(caseId), role, mode });
      putTrialHandoff({
        caseId,
        workId,
        role,
        mode,
        start: result,
        info: { question: info.question, suspect: info.suspect, victim: info.victim, workTitle: work.data?.title ?? '' },
      });
      navigate(`/works/${workId}/cases/${caseId}/trial`);
    } catch (err) {
      setError(err);
      setStarting(false);
      if (err.businessCode === 'ROLE_ALREADY_RECORDED') qc.invalidateQueries({ queryKey: ['setup', caseId] });
    }
  };

  return (
    <Page width="content" gap="lg" className={styles.page}>
      <Link to={`/works/${workId}`} className={styles.back}>
        ← {work.data?.title ?? '작품으로'}
      </Link>
      <div className={styles.head}>
        <div className={styles.people}>
          <span style={{ color: 'var(--pro)' }}>피의자</span> {info.suspect} · <span style={{ color: 'var(--def)' }}>피해자</span> {info.victim}
        </div>
        <h1 className={styles.h1}>{info.question}</h1>
        <div className={styles.summaryBox}>
          <div className={styles.boxLabel}>사건 개요</div>
          <p className={styles.summary}>{info.summary}</p>
        </div>
      </div>

      <section className={styles.section}>
        <h2 className={styles.h2}>역할 선택</h2>
        <div className={styles.roleGrid} role="radiogroup" aria-label="역할">
          {['DEFENSE', 'PROSECUTION'].map((r) => {
            const key = r === 'DEFENSE' ? 'def' : 'pro';
            const on = role === r;
            const dis = recorded[r];
            return (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={on}
                aria-disabled={dis}
                disabled={dis}
                className={`${styles.option} ${on ? styles.selected : ''} ${dis ? styles.disabled : ''}`}
                onClick={() => setPickedRole(r)}
              >
                <span className={styles.optionTop}>
                  <span className={styles.roleName} style={{ color: r === 'DEFENSE' ? 'var(--def)' : 'var(--pro)' }}>
                    <Icon name={roleIcon(r)} size="lg" />
                    {ROLE_NAME[r]}
                  </span>
                  <span className={styles.diff} style={{ color: DIFFICULTY_COLOR[roles[key]?.difficulty] }}>
                    난이도 {DIFFICULTY_NAME[roles[key]?.difficulty] ?? '-'}
                  </span>
                </span>
                <span className={styles.goal}>{ROLE_GOAL[r]}</span>
                <span className={styles.roleNote} style={{ color: dis ? 'var(--danger)' : 'var(--text-3)' }}>
                  {dis ? (
                    <>
                      <Icon name="lock" size="sm" /> 기록 있음 · 재도전 불가
                    </>
                  ) : (
                    '미도전'
                  )}
                </span>
              </button>
            );
          })}
        </div>
        {recorded.DEFENSE || recorded.PROSECUTION ? (
          <div className={styles.recordLink}>
            기록이 있는 역할은 <Link to={`/works/${workId}/cases/${caseId}/records`}>기록 보기</Link>에서 확인
          </div>
        ) : null}
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>모드 선택</h2>
        <div className={styles.modeGrid} role="radiogroup" aria-label="모드">
          {MODE_INFO.map((m) => {
            const on = mode === m.mode;
            return (
              <button key={m.mode} type="button" role="radio" aria-checked={on} className={`${styles.mode} ${on ? styles.selected : ''}`} onClick={() => setMode(m.mode)} disabled={both}>
                <span className={styles.modeName}>{MODE_NAME[m.mode]}</span>
                <span className={styles.modeInfo}>
                  판사 게이지 <b style={{ color: openColor(m.gauge) }}>{m.gauge}</b>
                  <br />
                  발언 판정 <b style={{ color: openColor(m.judge) }}>{m.judge}</b>
                  <br />공방 근거 카드 <b style={{ color: openColor(m.cards) }}>{m.cards}</b>
                  <br />
                  사건 경과 <b style={{ color: openColor(m.prog) }}>{m.prog}</b>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.tableHead}>
          <h2 className={styles.h2}>형량표</h2>
        </div>
        <div className={styles.penalties}>
          {TIER_TITLES.map((title, i) => {
            const tier = i + 1;
            const res = role ? resultName(role, tier) : '';
            return (
              <div key={title} className={styles.penalty}>
                <span className={styles.range}>{TIER_RANGES[i]}</span>
                <span className={styles.tierTitle} style={{ color: tierColor(tier) }}>
                  {title}
                </span>
                <span className={styles.sentence}>{sentenceOf(tier)}</span>
                {res ? (
                  <span className={styles.myResult} style={{ color: isWinName(res) ? 'var(--win)' : 'var(--pro)' }}>
                    내 결과 · {res}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <section className={styles.rules}>
        <div className={styles.rulesTitle}>게임 설명</div>
        <div>
          1. <b>모두 진술</b> · 검사 → 변호인 1번씩
        </div>
        <div>
          2. <b>공방</b> · 검사 근거 카드 중 무작위 2장 · 카드마다 검사 공격과 변호인 반론 3번씩 · 2장 후 게이지 47~53이면 3장째 진행
        </div>
        <div>
          3. <b>최후 변론</b> · 검사 → 변호인 · 앞의 공방을 종합한 결론
        </div>
        <div>
          4. <b>판결</b> · 발언마다 판사가 쟁점·근거·반박·새로움을 보고 게이지 이동
        </div>
        <div style={{ color: 'var(--admin)' }}>· 사건마다 역할별 1회만 가능 · 중간에 나가면 초기화, 기록 없음</div>
      </section>

      <InlineError error={error} />
      <div className={styles.startRow}>
        {role ? (
          <span className={styles.pick}>
            선택 · <b>{`${ROLE_NAME[role]} · ${MODE_NAME[mode]} 모드`}</b>
          </span>
        ) : (
          <span className={styles.pick}>두 역할 모두 기록 있음 · 추가 재판 불가</span>
        )}
        {starting ? (
          <span className={styles.pick} role="status">
            {role === 'DEFENSE' ? 'AI 검사가 모두 진술을 준비하는 중 · 몇 초 걸릴 수 있음' : '재판을 여는 중'}
          </span>
        ) : null}
        {both ? (
          <Button size="cta" to={`/works/${workId}`}>
            작품으로
          </Button>
        ) : (
          <Button size="cta" onClick={start} loading={starting} disabled={!role}>
            재판 시작
          </Button>
        )}
      </div>
    </Page>
  );
}
