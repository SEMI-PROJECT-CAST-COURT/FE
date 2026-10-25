import { useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Page } from '../components/Layout';
import Button from '../components/Button';
import Icon from '../components/Icon';
import Modal from '../components/Modal';
import Poster from '../components/Poster';
import { Empty, ErrorState, InlineError, Loading } from '../components/States';
import { deleteWork, fetchWork } from '../api/works';
import { deleteCase, fetchWorkCases } from '../api/cases';
import { isAdminAuthority, useAuth } from '../store/auth';
import { DIFFICULTY_COLOR, DIFFICULTY_NAME, TIER_TITLES, resultColor, resultName, tierColor } from '../lib/court';
import { formatDate } from '../lib/text';
import styles from './WorkDetailPage.module.css';

// 긴 질문은 글자 크기를 단계별로 줄여 2줄 안에 맞춘다. 가장 작은 크기로도 넘치면 2줄에서 자른다.
const QUESTION_SIZES = ['--fs-xl', '--fs-lg', '--fs-md', '--fs-sm', '--fs-xs'];

function CaseQuestion({ text }) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const fit = () => {
      delete el.dataset.clamped;
      for (const size of QUESTION_SIZES) {
        el.style.fontSize = `var(${size})`;
        if (el.scrollHeight <= el.clientHeight + 1) return;
      }
      el.dataset.clamped = '';
    };
    fit();
    document.fonts?.ready.then(fit);
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text]);

  return (
    <h3 ref={ref} className={styles.question} title={text}>
      {text}
    </h3>
  );
}

function RoleBox({ name, color, role, difficulty, record }) {
  return (
    <div className={styles.roleBox}>
      <div className={styles.roleHead}>
        <span style={{ color, fontWeight: 'var(--fw-semibold)' }}>{name}</span>
        <span style={{ color: DIFFICULTY_COLOR[difficulty] }}>{DIFFICULTY_NAME[difficulty] ?? difficulty}</span>
      </div>
      {record ? (
        <>
          <div className={styles.result} style={{ color: resultColor(role, record.penaltyTier) }}>
            {resultName(role, record.penaltyTier)}
          </div>
          <div className={styles.roleSentence} title={record.sentence || undefined}>
            {TIER_TITLES[record.penaltyTier - 1]}
            {record.sentence ? ` · ${record.sentence}` : ''}
          </div>
        </>
      ) : (
        <>
          <div className={styles.result} style={{ color: 'var(--text-3)' }}>
            미도전
          </div>
          <div className={styles.roleSentence} aria-hidden="true">
            &nbsp;
          </div>
        </>
      )}
    </div>
  );
}

export default function WorkDetailPage() {
  const { workId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isAdmin = isAdminAuthority(useAuth((s) => s.authority));
  const [openId, setOpenId] = useState(null);
  const [del, setDel] = useState(null); // { type: 'work' } | { type: 'case', item }
  const [delError, setDelError] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const work = useQuery({ queryKey: ['work', workId], queryFn: () => fetchWork(workId) });
  const cases = useQuery({ queryKey: ['workCases', workId], queryFn: () => fetchWorkCases(workId), enabled: work.isSuccess });

  if (work.isPending) return <Page><Loading /></Page>;
  if (work.isError) {
    return (
      <Page>
        <Link to="/works" className={styles.back}>
          ← 작품 목록
        </Link>
        <ErrorState error={work.error} onRetry={work.error.status === 404 ? undefined : () => work.refetch()} />
      </Page>
    );
  }

  const w = work.data;
  const progress = cases.data?.progress;
  const list = cases.data?.cases ?? [];

  const closeDel = () => {
    if (deleting) return;
    setDel(null);
    setDelError(null);
  };

  const confirmDelete = async () => {
    setDeleting(true);
    setDelError(null);
    try {
      if (del.type === 'work') {
        await deleteWork(w.workId);
        qc.invalidateQueries({ queryKey: ['works'] });
        qc.removeQueries({ queryKey: ['work', workId] });
        navigate('/works', { replace: true });
        return;
      }
      await deleteCase(del.item.caseId);
      qc.invalidateQueries({ queryKey: ['workCases', workId] });
      qc.invalidateQueries({ queryKey: ['works'] });
      setDel(null);
    } catch (err) {
      setDelError(err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Page gap="lg" className={styles.page}>
      <Link to="/works" className={styles.back}>
        ← 작품 목록
      </Link>

      <section className={styles.hero}>
        <div className={styles.poster}>
          <Poster src={w.posterUrl} alt={w.title} />
        </div>
        <div className={styles.info}>
          <div className={styles.cat}>{w.category}</div>
          <div className={styles.titleRow}>
            <h1 className={styles.h1}>{w.title}</h1>
            {isAdmin ? (
              <div className={styles.adminBtns}>
                <Button variant="admin" size="lg" to={`/admin/works/${w.workId}/edit`}>
                  수정
                </Button>
                <Button variant="dangerOutline" size="lg" onClick={() => setDel({ type: 'work' })}>
                  삭제
                </Button>
              </div>
            ) : null}
          </div>
          <div className={styles.meta}>
            <span>
              <span className={styles.metaKey}>원작자</span> {w.author}
            </span>
            <span>
              <span className={styles.metaKey}>공개 일자</span> {formatDate(w.releasedOn)}
            </span>
          </div>
          {w.summary ? <p className={styles.summary}>{w.summary}</p> : null}
        </div>
      </section>

      <section className={styles.caseSection}>
        <div className={styles.caseHead}>
          <h2 className={styles.h2}>사건 목록</h2>
          {progress ? (
            <div className={styles.progress}>
              <span>
                진행도 {progress.done} / {progress.total}
              </span>
              <span className={styles.bar} role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done} aria-label="사건 진행도">
                <span style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%` }} />
              </span>
            </div>
          ) : null}
          {isAdmin ? (
            <Button variant="admin" className={styles.newCase} to={`/admin/works/${w.workId}/cases/new`}>
              <Icon name="plus" size="md" />새 사건
            </Button>
          ) : null}
        </div>

        {cases.isPending ? <Loading label="사건 불러오는 중" /> : null}
        {cases.isError ? <ErrorState error={cases.error} onRetry={() => cases.refetch()} /> : null}
        {cases.isSuccess && list.length === 0 ? <Empty title="등록된 사건 없음" /> : null}

        <div className={styles.grid}>
          {list.map((c) => {
            const open = openId === c.caseId;
            const both = !!(c.my?.def && c.my?.pro);
            const hasRecord = !!(c.my?.def || c.my?.pro);
            return (
              <article key={c.caseId} className={styles.case}>
                <div className={styles.caseTop}>
                  <div className={styles.people}>
                    <span>
                      <span style={{ color: 'var(--pro)' }}>피의자</span> {c.suspect}
                    </span>
                    <span>
                      <span style={{ color: 'var(--def)' }}>피해자</span> {c.victim}
                    </span>
                  </div>
                  {isAdmin ? (
                    <div className={styles.iconBtns}>
                      <Link to={`/admin/works/${w.workId}/cases/${c.caseId}/edit`} className={`${styles.iconBtn} ${styles.edit}`} aria-label="사건 수정" title="사건 수정">
                        <Icon name="edit" size="18px" />
                      </Link>
                      <button type="button" className={`${styles.iconBtn} ${styles.remove}`} aria-label="사건 삭제" title="사건 삭제" onClick={() => setDel({ type: 'case', item: c })}>
                        <Icon name="trash" size="18px" />
                      </button>
                    </div>
                  ) : null}
                </div>
                <CaseQuestion text={c.question} />
                <div className={styles.roles}>
                  <RoleBox name="변호인" color="var(--def)" role="DEFENSE" difficulty={c.difficulty?.def} record={c.my?.def} />
                  <RoleBox name="검사" color="var(--pro)" role="PROSECUTION" difficulty={c.difficulty?.pro} record={c.my?.pro} />
                </div>
                {open ? (
                  <div className={styles.penalties} id={`penalties-${c.caseId}`}>
                    {c.penalties.length === 0 ? <span className={styles.sentence}>형벌표 없음</span> : null}
                    {c.penalties.map((p) => (
                      <div key={p.tier} className={styles.penalty}>
                        <span style={{ color: tierColor(p.tier) }} className={styles.penaltyTitle}>
                          {TIER_TITLES[p.tier - 1]}
                        </span>
                        <span>{p.sentence}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className={styles.actions}>
                  <button type="button" className={styles.toggle} aria-expanded={open} aria-controls={`penalties-${c.caseId}`} onClick={() => setOpenId(open ? null : c.caseId)}>
                    {open ? '형량 접기 ▴' : '형량 보기 ▾'}
                  </button>
                  {hasRecord ? (
                    <Button variant="secondary" to={`/works/${w.workId}/cases/${c.caseId}/records`}>
                      기록 보기
                    </Button>
                  ) : null}
                  {both ? null : <Button to={`/works/${w.workId}/cases/${c.caseId}/setup`}>재판 시작</Button>}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <Modal
        open={!!del}
        tone="danger"
        title={del?.type === 'work' ? '작품 삭제' : '사건 삭제'}
        onClose={closeDel}
        busy={deleting}
        actions={
          <>
            <Button variant="secondary" onClick={closeDel} disabled={deleting} data-autofocus>
              취소
            </Button>
            <Button variant="danger" onClick={confirmDelete} loading={deleting}>
              삭제
            </Button>
          </>
        }
      >
        <div className={styles.delName}>{del?.type === 'work' ? w.title : del?.item?.question}</div>
        <div className={styles.delBody}>
          {del?.type === 'work'
            ? `이 작품의 사건 ${list.length}개도 목록에서 함께 사라짐 · 이미 끝난 재판 기록은 내 재판 기록에 그대로 남음`
            : '이미 끝난 재판 기록은 내 재판 기록에 그대로 남음 (삭제된 사건으로 표시)'}
        </div>
        <div className={styles.delNote}>목록에서만 사라지는 소프트 삭제 · 복구 없음 · 재판 기록은 그대로 남음</div>
        <InlineError error={delError} />
      </Modal>
    </Page>
  );
}
