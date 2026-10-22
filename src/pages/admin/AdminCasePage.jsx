import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Page } from '../../components/Layout';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import Modal from '../../components/Modal';
import { ErrorState, InlineError, Loading } from '../../components/States';
import { createCase, fetchAdminCase, updateCase } from '../../api/cases';
import { fetchWork } from '../../api/works';
import { DRAFT_PATHS } from '../../api/draftSocket';
import { DIFFICULTY_COLOR, DIFFICULTY_NAME, TIER_TITLES, tierColor } from '../../lib/court';
import { isBlank, javaLength, strip } from '../../lib/text';
import { useDraftSocket } from './useDraftSocket';
import { CASE_FIELDS, LIMITS, caseFieldsValid, cardChanged, cardErrors, commonFields, diffLevel, fieldError, newKey, otherCards, penaltyError } from './caseForm';
import styles from './AdminCasePage.module.css';

const EMPTY_FORM = { question: '', suspect: '', victim: '', summary: '', progress: '' };
const emptyPenalties = () => [1, 2, 3, 4, 5, 6].map((tier) => ({ tier, sentence: '', orig: null }));

function Counter({ value, max }) {
  const len = javaLength(value);
  return <span className={len > max ? styles.over : styles.count}>{len} / {max}자</span>;
}

const SOCKET_STATE = {
  connecting: ['wait', '연결 중'],
  idle: ['wait', '대기'],
  open: ['ok', '연결됨'],
  closed: ['fail', '연결 끊김'],
  denied: ['fail', '인증 실패'],
};

// AI 초안 WS 3개를 동그라미로 표시 · 상태 글자는 툴팁과 스크린리더로, 실패는 글자로도 알린다.
function SocketDots({ items }) {
  const closed = items.filter(({ sock }) => sock.status === 'closed');
  const denied = items.some(({ sock }) => sock.status === 'denied');
  return (
    <div className={styles.socks} role="group" aria-label="AI 초안 연결 상태">
      {items.map(({ sock, label }) => {
        const [kind, text] = SOCKET_STATE[sock.status] ?? SOCKET_STATE.idle;
        return <span key={label} role="img" className={`${styles.sockDot} ${styles[`sock-${kind}`]}`} title={`${label} ${text}`} aria-label={`${label} ${text}`} />;
      })}
      {closed.length ? (
        <button type="button" className={styles.linkBtn} onClick={() => closed.forEach(({ sock }) => sock.reconnect())}>
          다시 연결
        </button>
      ) : null}
      {denied ? <span className={styles.sockErr}>인증 실패</span> : null}
    </div>
  );
}

export default function AdminCasePage() {
  const { workId, caseId } = useParams();
  const edit = !!caseId;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const work = useQuery({ queryKey: ['work', workId], queryFn: () => fetchWork(workId) });
  const detail = useQuery({ queryKey: ['adminCase', caseId], queryFn: () => fetchAdminCase(caseId), enabled: edit, staleTime: 0 });

  const caseSock = useDraftSocket(DRAFT_PATHS.case, { hello: true });
  const cardSock = useDraftSocket(DRAFT_PATHS.card);
  const penaltySock = useDraftSocket(DRAFT_PATHS.penalty);

  const [loaded, setLoaded] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [applied, setApplied] = useState(EMPTY_FORM); // 마지막으로 AI 후보 · 서버 값을 넣은 상태(편집 여부 판단)
  const [cards, setCards] = useState([]);
  const [deletedIds, setDeletedIds] = useState([]);
  const [penalties, setPenalties] = useState(emptyPenalties);
  const [penaltyApplied, setPenaltyApplied] = useState(null);
  const [penaltyHistory, setPenaltyHistory] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [prevQuestions, setPrevQuestions] = useState([]);
  const [picked, setPicked] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [rewrite, setRewrite] = useState(null);
  const [aiError, setAiError] = useState({}); // 구역별 AI 오류
  const [suggestFor, setSuggestFor] = useState(null); // 제안 요청 중인 카드 key
  const [confirm, setConfirm] = useState(null);
  const [touched, setTouched] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);
  const autoAsked = useRef(false);

  // 수정 화면: 관리자 사건 상세로 채운다
  if (edit && !loaded && detail.data) {
    const d = detail.data;
    const f = { question: d.question, suspect: d.suspect, victim: d.victim, summary: d.summary, progress: d.progress };
    setForm(f);
    setApplied(f);
    setCards(d.cards.map((c) => ({ key: newKey(), id: c.id, side: c.side, title: c.title, body: c.body, weight: c.weight, orig: { title: c.title, body: c.body, weight: c.weight }, suggestion: null })));
    setPenalties([1, 2, 3, 4, 5, 6].map((tier) => {
      const p = d.penalties.find((x) => x.tier === tier);
      return { tier, sentence: p?.sentence ?? '', orig: p?.sentence ?? null };
    }));
    setLoaded(true);
  }

  const wid = Number(workId);

  // 등록 화면: AI 초안 연결이 열리면 쟁점 후보 3개를 한 번 받는다
  const caseOpen = caseSock.status === 'open';
  const runCandidates = async (exclude) => {
    setAiError((e) => ({ ...e, s1: null }));
    try {
      const list = await caseSock.run('CANDIDATES', { step: 'CANDIDATES', workId: wid, excludeQuestions: exclude });
      setCandidates(Array.isArray(list) ? list : []);
      setPicked(null);
    } catch (err) {
      if (err.businessCode !== 'CANCELLED') setAiError((e) => ({ ...e, s1: err }));
    }
  };
  useEffect(() => {
    if (!edit && caseOpen && !autoAsked.current) {
      autoAsked.current = true;
      runCandidates([]);
    }
  });

  if (work.isPending || (edit && detail.isPending)) return <Page><Loading /></Page>;
  if (work.isError) return <Page><ErrorState error={work.error} /></Page>;
  if (edit && detail.isError) return <Page><ErrorState error={detail.error} onRetry={detail.error.status >= 500 ? () => detail.refetch() : undefined} /></Page>;

  const askOverwrite = (title, body, onConfirm) => setConfirm({ title, body, onConfirm });
  const dirty = CASE_FIELDS.some((f) => form[f] !== applied[f]);

  const pickCandidate = (i) => {
    const c = candidates[i];
    const apply = () => {
      const f = { question: c.question ?? '', suspect: c.suspect ?? '', victim: c.victim ?? '', summary: c.summary ?? '', progress: c.progress ?? '' };
      setForm(f);
      setApplied(f);
      setPicked(i);
      setRewrite(null);
    };
    if (dirty) askOverwrite('후보로 바꾸기', '직접 고친 쟁점 · 피의자 · 피해자 · 개요 · 경과가 이 후보 내용으로 바뀜', apply);
    else apply();
  };

  const reroll = () => {
    const exclude = [...prevQuestions, ...candidates.map((c) => c.question).filter(Boolean)];
    setPrevQuestions(exclude);
    runCandidates(exclude);
  };

  const requestRewrite = async () => {
    if (!caseFieldsValid(form) || isBlank(feedback)) {
      setAiError((e) => ({ ...e, s3: { message: '쟁점 · 피의자 · 피해자 · 개요 · 경과와 고칠 점을 모두 채워 주세요.' } }));
      return;
    }
    setAiError((e) => ({ ...e, s3: null }));
    try {
      const r = await caseSock.run('REWRITE', { step: 'REWRITE', workId: wid, ...commonFields(form), feedback });
      setRewrite(r);
    } catch (err) {
      if (err.businessCode !== 'CANCELLED') setAiError((e) => ({ ...e, s3: err }));
    }
  };

  const needCase = (key) => {
    if (caseFieldsValid(form)) return false;
    setAiError((e) => ({ ...e, [key]: { message: '1~3 구역(쟁점 · 피의자 · 피해자 · 개요 · 경과)을 먼저 기준에 맞게 채워 주세요.' } }));
    return true;
  };

  const addDraftCard = async (side) => {
    if (needCase('s4')) return;
    setAiError((e) => ({ ...e, s4: null }));
    try {
      const c = await cardSock.run(`CARDS-${side}`, { step: 'CARDS', workId: wid, side, ...commonFields(form), cards: otherCards(cards) });
      setCards((list) => [...list, { key: newKey(), id: null, side: c.side ?? side, title: c.title ?? '', body: c.body ?? '', weight: c.weight ?? 5, orig: null, suggestion: null, fromAi: true }]);
    } catch (err) {
      if (err.businessCode !== 'CANCELLED') setAiError((e) => ({ ...e, s4: err }));
    }
  };

  const suggest = async (card) => {
    if (needCase('s4')) return;
    if (isBlank(card.title) || isBlank(card.body)) {
      setAiError((e) => ({ ...e, s4: { message: '제안을 받으려면 카드 제목과 내용을 먼저 채워 주세요.' } }));
      return;
    }
    setAiError((e) => ({ ...e, s4: null }));
    setSuggestFor(card.key);
    try {
      const s = await cardSock.run('CARD_SUGGEST', {
        step: 'CARD_SUGGEST',
        workId: wid,
        card: { side: card.side, title: strip(card.title), body: strip(card.body), weight: Number(card.weight) || 0 },
        ...commonFields(form),
        cards: otherCards(cards, card.key),
      });
      setCards((list) => list.map((c) => (c.key === card.key ? { ...c, suggestion: s } : c)));
    } catch (err) {
      if (err.businessCode !== 'CANCELLED') setAiError((e) => ({ ...e, s4: err }));
    } finally {
      setSuggestFor(null);
    }
  };

  const updateCard = (key, patch) => setCards((list) => list.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  const removeCard = (card) => {
    setCards((list) => list.filter((c) => c.key !== card.key));
    if (card.id) setDeletedIds((ids) => [...ids, card.id]);
  };
  const addBlank = (side) => setCards((list) => [...list, { key: newKey(), id: null, side, title: '', body: '', weight: 5, orig: null, suggestion: null }]);

  const requestPenalties = async () => {
    if (needCase('s5')) return;
    setAiError((e) => ({ ...e, s5: null }));
    try {
      const list = await penaltySock.run('PENALTY', { step: 'PENALTY', workId: wid, ...commonFields(form), excludeSentences: penaltyHistory.slice(-60).map((s) => s.slice(0, 100)) });
      const rows = [1, 2, 3, 4, 5, 6].map((tier) => list.find((p) => p.tier === tier)?.sentence ?? '');
      const apply = () => {
        setPenalties((ps) => ps.map((p, i) => ({ ...p, sentence: rows[i] })));
        setPenaltyApplied(rows);
      };
      setPenaltyHistory((h) => [...h, ...rows.filter(Boolean)]);
      const current = penalties.map((p) => p.sentence);
      const edited = current.some((s) => s !== '') && (penaltyApplied ? current.some((s, i) => s !== penaltyApplied[i]) : true);
      if (edited) askOverwrite('형벌표 바꾸기', '입력한 형벌표 6단계가 새 AI 초안으로 바뀜', apply);
      else apply();
    } catch (err) {
      if (err.businessCode !== 'CANCELLED') setAiError((e) => ({ ...e, s5: err }));
    }
  };

  // 저장 검증 (서버와 같은 기준)
  const pros = cards.filter((c) => c.side === 'PROSECUTION');
  const defs = cards.filter((c) => c.side === 'DEFENSE');
  const sum = (list) => list.reduce((a, c) => a + (Number(c.weight) || 0), 0);
  const proSum = sum(pros);
  const defSum = sum(defs);
  const gap = Math.abs(proSum - defSum);
  const proDiff = diffLevel(proSum, defSum);
  const defDiff = diffLevel(defSum, proSum);
  const cardsReady = pros.length >= 3 && defs.length >= 3;
  const fieldErrs = CASE_FIELDS.reduce((acc, f) => ({ ...acc, [f]: fieldError(f, form[f]) }), {});
  const cardErrs = Object.fromEntries(cards.map((c) => [c.key, cardErrors(c)]));
  const penaltyErrs = penalties.map((p) => penaltyError(p.sentence));
  const missing = [];
  if (pros.length < 3) missing.push(`검사 카드 ${3 - pros.length}장`);
  if (defs.length < 3) missing.push(`변호 카드 ${3 - defs.length}장`);
  const allValid = !Object.values(fieldErrs).some(Boolean) && cards.every((c) => Object.keys(cardErrs[c.key]).length === 0) && penaltyErrs.every((e) => !e) && cardsReady;

  const save = async () => {
    setTouched(true);
    if (!allValid || saving) return;
    setSaving(true);
    setSaveError(null);
    const text = commonFields(form);
    try {
      if (edit) {
        const changed = cards.filter(cardChanged).map((c) => ({ ...(c.id ? { id: c.id } : {}), side: c.side, title: c.title, body: c.body, weight: Number(c.weight) }));
        const changedPenalties = penalties.filter((p) => p.sentence !== p.orig).map((p) => ({ tier: p.tier, sentence: p.sentence }));
        await updateCase(caseId, { ...text, cards: changed, deletedCardIds: deletedIds, penalties: changedPenalties });
        qc.invalidateQueries({ queryKey: ['adminCase', caseId] });
        qc.invalidateQueries({ queryKey: ['setup', caseId] });
      } else {
        await createCase({
          workId: wid,
          ...text,
          cards: cards.map((c) => ({ side: c.side, title: c.title, body: c.body, weight: Number(c.weight) })),
          penalties: penalties.map((p) => ({ tier: p.tier, sentence: p.sentence })),
        });
      }
      qc.invalidateQueries({ queryKey: ['workCases', workId] });
      qc.invalidateQueries({ queryKey: ['works'] });
      navigate(`/works/${workId}`);
    } catch (err) {
      setSaveError(err); // 실패하면 사건 · 카드 · 형벌표 모두 저장되지 않음 · 편집값 유지
      setSaving(false);
    }
  };

  const stepDone = [
    !fieldErrs.question,
    !fieldErrs.suspect && !fieldErrs.victim,
    !fieldErrs.summary && !fieldErrs.progress,
    cardsReady,
    penaltyErrs.every((e) => !e),
  ];
  const nowIdx = stepDone.findIndex((d) => !d);
  const steps = [
    { id: 's1', title: '쟁점 사건' },
    { id: 's2', title: '피의자 · 피해자' },
    { id: 's3', title: '개요 · 경과' },
    { id: 's4', title: '근거 카드', sub: `검사 ${pros.length} · 변호 ${defs.length}장` },
    { id: 's5', title: '형벌표' },
  ];

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const showErr = (key) => (touched ? fieldErrs[key] : null);
  const busyAny = caseSock.busy || cardSock.busy || penaltySock.busy;

  return (
    <Page gap="md" className={styles.page} as="div">
      <div className={styles.layout}>
        <aside className={styles.side}>
          <Link to={`/works/${workId}`} className={styles.back}>
            ← {work.data.title}
          </Link>
          <SocketDots
            items={[
              { sock: caseSock, label: 'AI 사건 초안' },
              { sock: cardSock, label: 'AI 카드 초안' },
              { sock: penaltySock, label: 'AI 형벌표 초안' },
            ]}
          />
          <nav aria-label="입력 단계" className={styles.steps}>
            {steps.map((st, i) => {
              const state = stepDone[i] ? 'done' : i === nowIdx ? 'now' : 'todo';
              return (
                <a key={st.id} href={`#${st.id}`} className={`${styles.step} ${state === 'now' ? styles.stepNow : ''}`}>
                  <span className={`${styles.dot} ${styles[`dot-${state}`]}`} aria-hidden="true">
                    {state === 'done' ? '✓' : i + 1}
                  </span>
                  <span className={styles.stepText}>
                    <span className={styles.stepTitle}>
                      {i + 1}. {st.title}
                      <span className="sr-only">{state === 'done' ? ' (완료)' : state === 'now' ? ' (지금 단계)' : ''}</span>
                    </span>
                    {st.sub ? <span className={styles.stepSub}>{st.sub}</span> : null}
                  </span>
                </a>
              );
            })}
          </nav>
        </aside>

        <main className={styles.main}>
          <div className={styles.head}>
            <h1 className={styles.h1}>{edit ? '사건 수정' : '새 사건 등록'}</h1>
            {busyAny ? (
              <div className={styles.busy} role="status">
                <span className={styles.spinner} aria-hidden="true" />
                AI 초안을 만드는 중 · 완료되면 한 번에 표시
                <Button variant="text" size="sm" onClick={() => [caseSock, cardSock, penaltySock].forEach((s) => s.busy && s.cancel())}>
                  중단
                </Button>
              </div>
            ) : null}
          </div>

          <section id="s1" className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.h2}>1. 쟁점 사건</h2>
              {!edit ? (
                <Button variant="secondary" size="md" onClick={reroll} disabled={!caseOpen || !!caseSock.busy}>
                  {candidates.length ? '다시 받기' : 'AI 후보 받기'}
                </Button>
              ) : null}
            </div>
            {!edit ? (
              <>
                {caseSock.busy === 'CANDIDATES' ? <Loading label="쟁점 후보를 만드는 중" /> : null}
                <div role="radiogroup" aria-label="쟁점 후보" className={styles.candidates}>
                  {candidates.map((c, i) => (
                    <button key={`${c.question}-${i}`} type="button" role="radio" aria-checked={picked === i} className={`${styles.candidate} ${picked === i ? styles.candidateOn : ''}`} onClick={() => pickCandidate(i)}>
                      <span className={`${styles.radio} ${picked === i ? styles.radioOn : ''}`} aria-hidden="true" />
                      <span className={styles.candidateText}>
                        <span>{c.question}</span>
                        <span className={styles.note}>
                          피의자 {c.suspect} · 피해자 {c.victim}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
                <InlineError error={aiError.s1} />
              </>
            ) : null}
            <label className={styles.field}>
              <span className={styles.labelRow}>
                <span className="sr-only">쟁점 질문</span>
                <Counter value={form.question} max={LIMITS.question} />
              </span>
              <input className={`${styles.input} ${showErr('question') ? styles.invalid : ''}`} value={form.question} onChange={setField('question')} aria-invalid={!!showErr('question') || undefined} />
              {showErr('question') ? <span className={styles.err}>{showErr('question')}</span> : null}
            </label>
          </section>

          <section id="s2" className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.h2}>2. 피의자 · 피해자</h2>
            </div>
            <div className={styles.twoCol}>
              {[
                ['suspect', '피의자', 'var(--pro)'],
                ['victim', '피해자', 'var(--def)'],
              ].map(([key, label, color]) => (
                <label key={key} className={styles.field}>
                  <span className={styles.labelRow}>
                    <span style={{ color }}>{label}</span>
                    <Counter value={form[key]} max={LIMITS[key]} />
                  </span>
                  <input className={`${styles.input} ${showErr(key) ? styles.invalid : ''}`} value={form[key]} onChange={setField(key)} aria-invalid={!!showErr(key) || undefined} />
                  {showErr(key) ? <span className={styles.err}>{showErr(key)}</span> : null}
                </label>
              ))}
            </div>
          </section>

          <section id="s3" className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.h2}>3. 사건 개요 · 사건 경과</h2>
            </div>
            {[
              ['summary', '사건 개요', 3],
              ['progress', '사건 경과', 4],
            ].map(([key, label, rows]) => (
              <label key={key} className={styles.field}>
                <span className={styles.labelRow}>
                  <span>{label}</span>
                  <Counter value={form[key]} max={LIMITS[key]} />
                </span>
                <textarea rows={rows} className={`${styles.input} ${styles.area} ${showErr(key) ? styles.invalid : ''}`} value={form[key]} onChange={setField(key)} aria-invalid={!!showErr(key) || undefined} />
                {showErr(key) ? <span className={styles.err}>{showErr(key)}</span> : null}
              </label>
            ))}
            <div className={styles.rewriteRow}>
              <label htmlFor="feedback" className="sr-only">
                고칠 점
              </label>
              <input id="feedback" className={styles.input} placeholder="고칠 점 (예: 경과를 더 짧게, 스포일러 줄이기)" value={feedback} onChange={(e) => setFeedback(e.target.value)} />
              <Button variant="secondary" size="lg" onClick={requestRewrite} disabled={!caseOpen || !!caseSock.busy} loading={caseSock.busy === 'REWRITE'}>
                <Icon name="aiRewrite" size="sm" />
                AI로 다시 쓰기
              </Button>
            </div>
            {rewrite ? (
              <div className={styles.suggest}>
                <span className={styles.suggestTitle}>AI 다시 쓰기 결과 · 적용 전 미리보기</span>
                <span className={styles.suggestBody}>
                  <b>개요</b> {rewrite.summary}
                </span>
                <span className={styles.suggestBody}>
                  <b>경과</b> {rewrite.progress}
                </span>
                <div className={styles.suggestBtns}>
                  <Button
                    size="sm"
                    onClick={() => {
                      setForm((f) => ({ ...f, summary: rewrite.summary ?? f.summary, progress: rewrite.progress ?? f.progress }));
                      setRewrite(null);
                    }}
                  >
                    적용
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setRewrite(null)}>
                    무시
                  </Button>
                </div>
              </div>
            ) : null}
            <InlineError error={aiError.s3} />
          </section>

          <section id="s4" className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.h2}>4. 근거 카드</h2>
            </div>
            <div className={styles.sums}>
              <div className={styles.sumBox}>
                <span className={styles.note}>검사 측 · {pros.length}장</span>
                <span className={styles.sumValue} style={{ color: 'var(--pro)' }}>
                  {proSum}
                </span>
                <span className={styles.sumSub} style={{ color: DIFFICULTY_COLOR[proDiff] }}>
                  검사 난이도 · {DIFFICULTY_NAME[proDiff]}
                </span>
              </div>
              <div className={styles.sumBox}>
                <span className={styles.note}>변호 측 · {defs.length}장</span>
                <span className={styles.sumValue} style={{ color: 'var(--def)' }}>
                  {defSum}
                </span>
                <span className={styles.sumSub} style={{ color: DIFFICULTY_COLOR[defDiff] }}>
                  변호인 난이도 · {DIFFICULTY_NAME[defDiff]}
                </span>
              </div>
              <div className={styles.sumBox} style={{ borderColor: gap >= 10 ? 'var(--danger-line-2)' : 'var(--win-line)' }}>
                <span className={styles.note}>가중치 합 차이</span>
                <span className={styles.sumValue} style={{ color: gap >= 10 ? 'var(--danger)' : 'var(--win)' }}>
                  {gap}
                </span>
                <span className={styles.sumSub} style={{ color: gap >= 10 ? 'var(--danger)' : 'var(--win)' }}>
                  {gap >= 10 ? '한쪽이 많이 유리함' : '균형 맞음'}
                </span>
              </div>
            </div>

            {[
              ['PROSECUTION', '검사 측', 'var(--pro)', pros],
              ['DEFENSE', '변호 측', 'var(--def)', defs],
            ].map(([side, name, color, list]) => (
              <div key={side} className={styles.sideBlock}>
                <div className={styles.sideHead}>
                  <span className={styles.sideName} style={{ color }}>
                    {name} 카드
                  </span>
                  <div className={styles.sideBtns}>
                    <button type="button" className={`${styles.aiBtn} ${side === 'PROSECUTION' ? styles.aiPro : styles.aiDef}`} onClick={() => addDraftCard(side)} disabled={cardSock.status !== 'open' || !!cardSock.busy}>
                      {cardSock.busy === `CARDS-${side}` ? '만드는 중…' : '+ AI 초안'}
                    </button>
                    <Button variant="secondary" size="sm" onClick={() => addBlank(side)}>
                      + 직접 쓰기
                    </Button>
                  </div>
                </div>
                {list.map((c) => {
                  const err = cardErrs[c.key];
                  const show = touched || c.fromAi;
                  return (
                    <div key={c.key} className={`${styles.cardBox} ${side === 'PROSECUTION' ? styles.cardPro : styles.cardDef}`}>
                      <div className={styles.cardTop}>
                        <input className={`${styles.input} ${styles.cardTitle} ${show && err.title ? styles.invalid : ''}`} aria-label={`${name} 카드 제목`} value={c.title} onChange={(e) => updateCard(c.key, { title: e.target.value })} />
                        <label className={styles.weight}>
                          <span>가중치</span>
                          <input type="number" min={1} max={20} step={1} className={`${styles.input} ${styles.weightInput} ${show && err.weight ? styles.invalid : ''}`} value={c.weight} onChange={(e) => updateCard(c.key, { weight: e.target.value === '' ? '' : Number(e.target.value) })} />
                        </label>
                        <Button variant="secondary" size="sm" onClick={() => suggest(c)} disabled={cardSock.status !== 'open' || !!cardSock.busy} loading={suggestFor === c.key}>
                          AI 수정 제안
                        </Button>
                        <button type="button" className={styles.removeBtn} onClick={() => removeCard(c)}>
                          삭제
                        </button>
                      </div>
                      <textarea rows={2} aria-label={`${name} 카드 내용`} className={`${styles.input} ${styles.area} ${styles.cardBody} ${show && err.body ? styles.invalid : ''}`} value={c.body} onChange={(e) => updateCard(c.key, { body: e.target.value })} />
                      <div className={styles.cardMeta}>
                        <span>
                          제목 <Counter value={c.title} max={LIMITS.cardTitle} /> · 내용 <Counter value={c.body} max={LIMITS.cardBody} />
                        </span>
                        {show && Object.keys(err).length ? <span className={styles.err}>{Object.values(err).join(' · ')}</span> : null}
                        {c.id && cardChanged(c) ? <span className={styles.note}>수정됨</span> : null}
                        {!c.id ? <span className={styles.note}>새 카드</span> : null}
                      </div>
                      {c.suggestion ? (
                        <div className={styles.suggest}>
                          <span className={styles.suggestTitle}>AI 수정 제안</span>
                          <span className={styles.suggestBody}>{c.suggestion.message}</span>
                          {c.suggestion.changed ? (
                            <span className={styles.suggestBody}>
                              → 「{c.suggestion.title}」 {c.suggestion.body} · 가중치 {c.suggestion.weight}
                            </span>
                          ) : (
                            <span className={styles.note}>변경 없음</span>
                          )}
                          <div className={styles.suggestBtns}>
                            {c.suggestion.changed ? (
                              <Button size="sm" onClick={() => updateCard(c.key, { title: c.suggestion.title, body: c.suggestion.body, weight: c.suggestion.weight, suggestion: null, fromAi: true })}>
                                적용
                              </Button>
                            ) : null}
                            <Button size="sm" variant="secondary" onClick={() => updateCard(c.key, { suggestion: null })}>
                              {c.suggestion.changed ? '무시' : '닫기'}
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
                {list.length < 3 ? (
                  <div className={styles.short}>
                    {name} 카드 {3 - list.length}장 부족
                  </div>
                ) : null}
              </div>
            ))}
            <InlineError error={aiError.s4} />
          </section>

          <section id="s5" className={styles.section}>
            <h2 className={styles.h2}>5. 형벌표</h2>
            {penalties.map((p, i) => (
              <label key={p.tier} className={styles.penaltyRow}>
                <span className={styles.penaltyTitle} style={{ color: tierColor(p.tier) }}>
                  {TIER_TITLES[i]}
                </span>
                <input
                  className={`${styles.input} ${styles.penaltyInput} ${touched && penaltyErrs[i] ? styles.invalid : ''}`}
                  value={p.sentence}
                  onChange={(e) => setPenalties((ps) => ps.map((x) => (x.tier === p.tier ? { ...x, sentence: e.target.value } : x)))}
                />
                <Counter value={p.sentence} max={LIMITS.sentence} />
              </label>
            ))}
            <div className={styles.penaltyBtns}>
              <Button variant="secondary" size="md" onClick={requestPenalties} disabled={penaltySock.status !== 'open' || !!penaltySock.busy} loading={penaltySock.busy === 'PENALTY'}>
                {penalties.some((p) => p.sentence) ? 'AI로 다시 만들기' : 'AI로 만들기'}
              </Button>
            </div>
            <InlineError error={aiError.s5} />
          </section>

          <InlineError error={saveError} />
          <div className={styles.saveBar}>
            <div className={styles.saveText} style={{ color: cardsReady ? 'var(--win)' : 'var(--admin)' }}>
              {cardsReady ? `양쪽 모두 3장 이상 · ${edit ? '저장' : '등록'} 가능` : `${missing.join(', ')} 부족 · ${edit ? '저장' : '등록'} 불가`}
              {touched && !allValid && cardsReady ? <span className={styles.err}> · 입력 기준에 맞지 않는 항목 확인</span> : null}
            </div>
            <div className={styles.saveBtns}>
              <Button variant="secondary" size="xl" to={`/works/${workId}`}>
                취소
              </Button>
              <Button size="xl" onClick={save} disabled={!cardsReady} loading={saving}>
                {edit ? '저장' : '등록'}
              </Button>
            </div>
          </div>
        </main>
      </div>

      <Modal
        open={!!confirm}
        title={confirm?.title}
        onClose={() => setConfirm(null)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)} data-autofocus>
              유지
            </Button>
            <Button
              onClick={() => {
                confirm.onConfirm();
                setConfirm(null);
              }}
            >
              바꾸기
            </Button>
          </>
        }
      >
        <div className={styles.confirmBody}>{confirm?.body}</div>
      </Modal>
    </Page>
  );
}
