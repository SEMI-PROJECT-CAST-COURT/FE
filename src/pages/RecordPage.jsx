import { Link, useLocation, useParams, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Page } from '../components/Layout';
import Button from '../components/Button';
import Icon from '../components/Icon';
import { CheckChips } from '../components/SpeakingBubble';
import { Empty, ErrorState, Loading } from '../components/States';
import { fetchCaseRecords, fetchTrialRecord } from '../api/trials';
import { fetchCaseSetup } from '../api/cases';
import { fetchWork } from '../api/works';
import { GRADE, MODE_NAME, ROLE_NAME, formatDelta, josa, opposite, resultColor, resultName, roleColor, roleIcon, tierColor } from '../lib/court';
import styles from './RecordPage.module.css';

const ROLES = ['DEFENSE', 'PROSECUTION'];
const keyOf = (role) => (role === 'DEFENSE' ? 'def' : 'pro');
const dotColor = (pos) => (pos === 50 ? 'var(--text-1b)' : pos < 50 ? 'var(--def)' : 'var(--pro)');
const deltaColor = (d) => (d < 0 ? 'var(--def)' : d > 0 ? 'var(--pro)' : 'var(--text-2)');

// 사건 기록(역할 탭): /works/:workId/cases/:caseId/records · 내 기록에서 온 단일 기록: /records/:recordId
export default function RecordPage() {
  const { workId, caseId, recordId } = useParams();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const byCase = !!caseId;

  const summary = useQuery({ queryKey: ['caseRecords', caseId], queryFn: () => fetchCaseRecords(caseId), enabled: byCase });
  const setup = useQuery({ queryKey: ['setup', caseId], queryFn: () => fetchCaseSetup(caseId), enabled: byCase, retry: false });
  const work = useQuery({ queryKey: ['work', workId], queryFn: () => fetchWork(workId), enabled: byCase && !!workId });

  const s = summary.data;
  const wanted = params.get('role');
  const view = byCase && s ? (ROLES.includes(wanted) && s[keyOf(wanted)] ? wanted : s.latest ?? (s.def ? 'DEFENSE' : s.pro ? 'PROSECUTION' : null)) : null;
  const targetId = byCase ? (view ? s?.[keyOf(view)]?.trialId : null) : recordId;

  const record = useQuery({ queryKey: ['record', String(targetId)], queryFn: () => fetchTrialRecord(targetId), enabled: !!targetId });

  if (byCase && summary.isPending) return <Page><Loading /></Page>;
  if (byCase && summary.isError) {
    return (
      <Page>
        <ErrorState error={summary.error} onRetry={() => summary.refetch()} />
      </Page>
    );
  }
  if (byCase && !view) {
    return (
      <Page>
        <Empty title="이 사건의 재판 기록 없음" actions={<Button to={`/works/${workId}/cases/${caseId}/setup`}>재판 준비로</Button>} />
      </Page>
    );
  }

  const rec = record.data;
  const role = rec?.role ?? view;
  const snapshot = location.state ?? {};
  const headInfo = byCase
    ? { workTitle: work.data?.title, question: setup.data?.case?.question, suspect: setup.data?.case?.suspect, victim: setup.data?.case?.victim }
    : { workTitle: snapshot.workTitle, question: snapshot.question };
  const caseDeleted = byCase ? setup.isError && setup.error?.status === 404 : !!snapshot.caseDeleted;
  const other = role ? opposite(role) : null;
  const otherRecord = byCase && other ? s?.[keyOf(other)] : null;
  const canRetry = byCase && !!other && !otherRecord && !caseDeleted && setup.isSuccess;
  const bothDone = byCase && !!(s?.def && s?.pro);

  const tabs = byCase ? ROLES : role ? [role] : [];

  // 대화 + 단계 구분선 (각 카드의 첫 검사 공격은 rebut 판정 제외(null) → 카드 시작으로 표시)
  const rows = [];
  let lastStage = null;
  let cardNo = 0;
  const keySet = new Set(rec?.keyMoments ?? []);
  (rec?.speakings ?? []).forEach((sp) => {
    const firstAttack = sp.stage === 'CARD' && sp.side === 'PROSECUTION' && sp.checks?.rebut === null;
    if (sp.stage !== lastStage || firstAttack) {
      if (sp.stage === 'CARD') cardNo = firstAttack || lastStage !== 'CARD' ? cardNo + 1 : cardNo;
      rows.push({ sep: true, key: `sep-${sp.seq}`, title: sp.stage === 'OPENING' ? '모두 진술' : sp.stage === 'CLOSING' ? '최후 변론' : `공방 · ${cardNo}번째 카드` });
    }
    lastStage = sp.stage;
    rows.push({ sep: false, key: `sp-${sp.seq}`, sp });
  });
  const speakingBySeq = new Map((rec?.speakings ?? []).map((sp) => [sp.seq, sp]));
  const whoOf = (sp, short) => (sp.side === role ? (short ? '나' : `나 · ${ROLE_NAME[sp.side]}`) : short ? `AI ${ROLE_NAME[sp.side]}` : `AI · ${ROLE_NAME[sp.side]}`);
  const backTo = byCase ? `/works/${workId}` : '/me/records';

  return (
    <Page gap="sm" className={styles.page}>
      <Link to={byCase ? `/works/${workId}` : '/me/records'} className={styles.back}>
        ← {byCase ? work.data?.title ?? '작품으로' : '내 재판 기록'}
      </Link>

      <div role="tablist" aria-label="역할별 기록" className={styles.tabs}>
        {tabs.map((r) => {
          const item = byCase ? s?.[keyOf(r)] : rec ? { penaltyTier: rec.penaltyTier } : null;
          const has = !!item;
          const on = role === r;
          const when = byCase && s?.latest ? (s.latest === r ? '최근' : '이전') : '';
          return (
            <button
              key={r}
              type="button"
              role="tab"
              aria-selected={on}
              disabled={!has}
              className={`${styles.tab} ${on ? styles.tabOn : ''}`}
              onClick={() => {
                if (has && byCase) setParams({ role: r }, { replace: true });
              }}
            >
              <span className={styles.tabTitle} style={{ color: has ? roleColor(r) : 'var(--text-4)' }}>
                <Icon name={roleIcon(r)} size="md" />
                {ROLE_NAME[r]} 기록
              </span>
              <span className={styles.tabSub}>{has ? `${resultName(r, item.penaltyTier)}${when ? ` · ${when}` : ''}` : '기록 없음'}</span>
            </button>
          );
        })}
      </div>

      {record.isPending ? <Loading label="기록 불러오는 중" /> : null}
      {record.isError ? <ErrorState error={record.error} onRetry={record.error.status >= 500 ? () => record.refetch() : undefined} /> : null}

      {rec ? (
        <>
          <section className={styles.summary}>
            <div className={styles.caseInfo}>
              <div className={styles.meta}>
                {[headInfo.workTitle, headInfo.suspect ? `피의자 ${headInfo.suspect}` : null, headInfo.victim ? `피해자 ${headInfo.victim}` : null].filter(Boolean).join(' · ')}
                {caseDeleted ? <span className={styles.deleted}> · 삭제된 사건</span> : null}
              </div>
              <h1 className={styles.h1}>{headInfo.question ?? '재판 기록'}</h1>
            </div>
            <div className={styles.facts}>
              <div className={styles.fact}>
                <div className={styles.factKey}>내 역할 · 모드</div>
                <div className={styles.factValue} style={{ color: roleColor(rec.role) }}>
                  {ROLE_NAME[rec.role]}
                </div>
                <div className={styles.factSub}>{MODE_NAME[rec.mode]} 모드</div>
              </div>
              <div className={styles.fact}>
                <div className={styles.factKey}>판결 · 형량</div>
                <div className={styles.factValue} style={{ color: tierColor(rec.penaltyTier) }}>
                  {rec.title}
                </div>
                <div className={styles.factSub}>{rec.sentence}</div>
              </div>
              <div className={styles.fact}>
                <div className={styles.factKey}>내 결과</div>
                <div className={styles.factValue} style={{ color: resultColor(rec.role, rec.penaltyTier) }}>
                  {resultName(rec.role, rec.penaltyTier)}
                </div>
              </div>
            </div>
          </section>

          <div className={styles.body}>
            <section className={styles.talks}>
              <div className={styles.talksHead}>
                <h2 className={styles.h2}>재판 대화와 게이지 흐름</h2>
                <div className={styles.legend}>
                  <span style={{ color: 'var(--def)' }}>← 0 무죄</span>
                  <span style={{ color: 'var(--pro)' }}>유죄 100 →</span>
                </div>
              </div>
              <div className={styles.talkScroll} role="region" aria-label="재판 대화 기록" tabIndex={0}>
                {rows.map((r) =>
                  r.sep ? (
                    <div key={r.key} className={styles.sep}>
                      <span className={styles.sepLine} />
                      <span>{r.title}</span>
                      <span className={styles.sepLine} />
                    </div>
                  ) : (
                    <div key={r.key} className={`${styles.row} ${keySet.has(r.sp.seq) ? styles.key : ''}`}>
                      <div className={styles.rowHead}>
                        <div className={styles.rowWho}>
                          <span className={styles.no}>{r.sp.seq}번째</span>
                          <span className={styles.who} style={{ color: roleColor(r.sp.side) }}>
                            {whoOf(r.sp)}
                          </span>
                          {r.sp.grade ? (
                            <span className={styles.grade} style={{ color: GRADE[r.sp.grade]?.color }}>
                              {GRADE[r.sp.grade]?.name ?? r.sp.grade}
                            </span>
                          ) : null}
                          {keySet.has(r.sp.seq) ? <span className={styles.keyBadge}>결정적</span> : null}
                        </div>
                        <span className={styles.delta} style={{ color: deltaColor(r.sp.delta) }}>
                          {formatDelta(r.sp.delta)} → {r.sp.scoreAfter}
                        </span>
                      </div>
                      <div className={styles.mini} aria-hidden="true">
                        <span className={styles.miniCenter} />
                        <span className={styles.miniDot} style={{ left: `${r.sp.scoreAfter}%`, background: dotColor(r.sp.scoreAfter) }} />
                      </div>
                      <div className={styles.text}>{r.sp.content}</div>
                      <div className={styles.checks}>
                        <CheckChips checks={r.sp.checks} />
                      </div>
                    </div>
                  ),
                )}
              </div>
            </section>

            <aside className={styles.aside}>
              <div className={styles.panel}>
                <h2 className={styles.h2}>판사 총평</h2>
                <p className={styles.summaryText}>{rec.judgeSummary}</p>
              </div>
              <div className={styles.panel}>
                <h2 className={styles.h2}>결정적 순간</h2>
                {(rec.keyMoments ?? []).map((seq) => {
                  const sp = speakingBySeq.get(seq);
                  if (!sp) return null;
                  return (
                    <div key={seq} className={styles.moment}>
                      <div className={styles.momentText}>
                        <span className={styles.caption}>
                          {seq}번째 · {whoOf(sp, true)} · {GRADE[sp.grade]?.name ?? ''}
                        </span>
                        <span className={styles.momentBody}>{sp.content.length > 38 ? `${sp.content.slice(0, 38)}…` : sp.content}</span>
                      </div>
                      <span className={styles.momentDelta} style={{ color: deltaColor(sp.delta) }}>
                        {formatDelta(sp.delta)}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className={styles.btns}>
                {canRetry ? (
                  <Button size="xl" className={styles.grow} to={`/works/${workId}/cases/${caseId}/setup`}>
                    {josa(ROLE_NAME[other], '으로', '로')} 다시하기
                  </Button>
                ) : null}
                <Button variant="secondary" size="xl" className={styles.grow} to={backTo}>
                  {byCase ? '작품으로' : '내 재판 기록으로'}
                </Button>
              </div>
              {bothDone ? <div className={styles.caption}>변호인·검사 모두 기록 있음 · 추가 재판 불가</div> : null}
            </aside>
          </div>
        </>
      ) : null}
    </Page>
  );
}
