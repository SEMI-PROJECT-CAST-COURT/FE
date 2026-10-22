import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Page } from '../components/Layout';
import Button from '../components/Button';
import Chip from '../components/Chip';
import { Empty, ErrorState, Loading } from '../components/States';
import { fetchMyStats, fetchMyTrials } from '../api/trials';
import { fetchWorks } from '../api/works';
import { ROLE_NAME, isWinName, resultColor, resultName, roleColor } from '../lib/court';
import styles from './MyRecordsPage.module.css';

const ROLE_FILTERS = [
  { value: '', label: '전체' },
  { value: 'DEFENSE', label: '변호인' },
  { value: 'PROSECUTION', label: '검사' },
];
const OUTCOME_FILTERS = [
  { value: '', label: '전체' },
  { value: 'WIN', label: '승' },
  { value: 'LOSE', label: '패' },
];

// 작품 필터 옵션: 작품 목록 API(페이지 8개)를 끝까지 읽는다. 삭제된 작품은 목록에 없다.
async function fetchAllWorks() {
  const first = await fetchWorks({ page: 1, sort: 'NAME' });
  const items = [...first.content];
  for (let p = 2; p <= Math.min(first.totalPages, 50); p += 1) {
    const next = await fetchWorks({ page: p, sort: 'NAME' });
    items.push(...next.content);
  }
  return items;
}

const pct = (win, total) => (total ? `${Math.round((win / total) * 100)}%` : '0%');

export default function MyRecordsPage() {
  const [params, setParams] = useSearchParams();
  const role = ROLE_FILTERS.some((r) => r.value === params.get('role')) ? params.get('role') ?? '' : '';
  const outcome = OUTCOME_FILTERS.some((o) => o.value === params.get('outcome')) ? params.get('outcome') ?? '' : '';
  const workId = Number(params.get('workId')) || null;
  const [distRole, setDistRole] = useState('def');
  const sentinel = useRef(null);

  const stats = useQuery({ queryKey: ['myStats'], queryFn: fetchMyStats });
  const works = useQuery({ queryKey: ['allWorks'], queryFn: fetchAllWorks, staleTime: 60_000 });
  const trials = useInfiniteQuery({
    queryKey: ['myTrials', { role, outcome, workId }],
    queryFn: ({ pageParam }) => fetchMyTrials({ role, outcome, workId, cursor: pageParam }),
    initialPageParam: null,
    getNextPageParam: (last) => last?.nextCursor ?? undefined, // null 이면 중단
  });

  const update = (next) => {
    const merged = { role, outcome, workId, ...next };
    const sp = new URLSearchParams();
    if (merged.role) sp.set('role', merged.role);
    if (merged.outcome) sp.set('outcome', merged.outcome);
    if (merged.workId) sp.set('workId', merged.workId);
    setParams(sp, { replace: true });
  };

  // 스크롤이 목록 끝에 닿으면 다음 커서 페이지를 불러온다
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = trials;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return undefined;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && !isFetchingNextPage) fetchNextPage();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (stats.isPending) return <Page><Loading /></Page>;
  if (stats.isError) {
    return (
      <Page>
        <h1 className={styles.h1}>내 재판 기록</h1>
        <ErrorState error={stats.error} onRetry={() => stats.refetch()} />
      </Page>
    );
  }

  const st = stats.data;
  const items = trials.data?.pages.flatMap((p) => p.items) ?? [];
  const labels = (r) => [1, 2, 3, 4, 5, 6].map((t) => resultName(r === 'def' ? 'DEFENSE' : 'PROSECUTION', t));
  const counts = st.distribution?.[distRole] ?? [0, 0, 0, 0, 0, 0];
  const max = Math.max(1, ...counts);

  return (
    <Page gap="lg">
      <h1 className={styles.h1}>내 재판 기록</h1>

      {st.total === 0 ? (
        <Empty
          title="완료한 재판 없음"
          actions={
            <>
              <Button variant="secondary" size="xl" to="/rules">
                재판 규칙 보기
              </Button>
              <Button size="xl" to="/works">
                작품 둘러보기
              </Button>
            </>
          }
        />
      ) : (
        <>
          <section className={styles.stats}>
            <div className={styles.stat}>
              <div className={styles.statKey}>총 재판</div>
              <div className={styles.statRow}>
                <span className={styles.big}>{st.total}건</span>
                <span className={styles.statSub}>
                  변호인 {st.byRole.def.total} · 검사 {st.byRole.pro.total}
                </span>
              </div>
            </div>
            {[
              ['def', 'DEFENSE'],
              ['pro', 'PROSECUTION'],
            ].map(([k, r]) => {
              const v = st.byRole[k];
              const p = pct(v.win, v.total);
              return (
                <div key={k} className={styles.stat}>
                  <div className={styles.statKey}>{ROLE_NAME[r]} 승률</div>
                  <div className={styles.statRow}>
                    <span className={styles.big} style={{ color: roleColor(r) }}>
                      {p}
                    </span>
                    <span className={styles.statSub}>
                      {v.win}승 {v.lose}패
                    </span>
                  </div>
                  <div className={styles.rateBar} role="img" aria-label={`${ROLE_NAME[r]} 승률 ${p}`}>
                    <span style={{ width: p, background: roleColor(r) }} />
                  </div>
                </div>
              );
            })}
          </section>

          <section className={styles.dist}>
            <div className={styles.distHead}>
              <h2 className={styles.h2}>결과 분포</h2>
              <div role="group" aria-label="분포 역할" className={styles.distTabs}>
                <Chip size="sm" pressed={distRole === 'def'} onClick={() => setDistRole('def')}>
                  변호인
                </Chip>
                <Chip size="sm" pressed={distRole === 'pro'} onClick={() => setDistRole('pro')}>
                  검사
                </Chip>
              </div>
            </div>
            <div className={styles.bars}>
              {labels(distRole).map((label, i) => (
                <div key={label} className={styles.barCol}>
                  <span className={styles.barN}>{counts[i]}</span>
                  <div className={styles.bar} style={{ height: `${Math.max(4, Math.round((counts[i] / max) * 90))}px`, background: isWinName(label) ? 'var(--win-bar)' : 'var(--pro-line-2)', animationDelay: `${i * 60}ms` }} />
                  <span className={styles.barLabel}>{label}</span>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.listSection}>
            <div className={styles.listHead}>
              <h2 className={styles.h2Big}>재판 목록</h2>
              <span className={styles.count}>{items.length}건{trials.hasNextPage ? ' +' : ''}</span>
            </div>
            <div className={styles.filters}>
              <div role="group" aria-label="역할" className={styles.group}>
                <span className={styles.groupLabel}>역할</span>
                {ROLE_FILTERS.map((r) => (
                  <Chip key={r.label} size="sm" pressed={role === r.value} onClick={() => update({ role: r.value })}>
                    {r.label}
                  </Chip>
                ))}
              </div>
              <div role="group" aria-label="승패" className={styles.group}>
                <span className={styles.groupLabel}>승패</span>
                {OUTCOME_FILTERS.map((o) => (
                  <Chip key={o.label} size="sm" pressed={outcome === o.value} onClick={() => update({ outcome: o.value })}>
                    {o.label}
                  </Chip>
                ))}
              </div>
              <label className={styles.workFilter}>
                <span className={styles.groupLabel}>작품</span>
                <select className={styles.select} value={workId ?? ''} onChange={(e) => update({ workId: Number(e.target.value) || null })}>
                  <option value="">전체 작품</option>
                  {(works.data ?? []).map((w) => (
                    <option key={w.workId} value={w.workId}>
                      {w.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {trials.isPending ? <Loading label="기록 불러오는 중" /> : null}
            {trials.isError && !trials.data ? <ErrorState error={trials.error} onRetry={() => trials.refetch()} /> : null}
            {trials.isSuccess && items.length === 0 ? <div className={styles.none}>조건에 맞는 재판 없음</div> : null}
            <div className={styles.items}>
              {items.map((t) => (
                <Link key={t.trialId} to={`/records/${t.trialId}`} state={{ workTitle: t.workTitle, question: t.question, caseDeleted: t.caseDeleted }} className={styles.item}>
                  <div className={styles.itemMain}>
                    <div className={styles.itemWork}>
                      {t.workTitle}
                      {t.caseDeleted ? <span className={styles.deleted}> · 삭제된 사건</span> : null}
                    </div>
                    <div className={styles.itemQ}>{t.question}</div>
                  </div>
                  <div className={styles.itemSide}>
                    <span style={{ color: roleColor(t.role) }}>{ROLE_NAME[t.role]}</span>
                    <span className={styles.itemResult} style={{ color: resultColor(t.role, t.penaltyTier) }}>
                      {resultName(t.role, t.penaltyTier)}
                    </span>
                    <span aria-hidden="true" className={styles.chev}>
                      ›
                    </span>
                  </div>
                </Link>
              ))}
            </div>
            {trials.hasNextPage ? (
              <div ref={sentinel} className={styles.more}>
                {trials.isFetchingNextPage ? (
                  <span className={styles.moreLoading} role="status">
                    <span className={styles.spinner} aria-hidden="true" />
                    다음 기록 불러오는 중
                  </span>
                ) : (
                  <Button variant="text" onClick={() => trials.fetchNextPage()}>
                    다음 기록 불러오기
                  </Button>
                )}
              </div>
            ) : null}
            {trials.isFetchNextPageError ? <ErrorState error={trials.error} onRetry={() => trials.fetchNextPage()} /> : null}
          </section>
        </>
      )}
    </Page>
  );
}
