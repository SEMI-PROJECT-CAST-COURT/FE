import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useBlocker, useNavigate, useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Page } from '../../components/Layout';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import Modal from '../../components/Modal';
import Gauge from '../../components/Gauge';
import EvidenceCard from '../../components/EvidenceCard';
import SpeakingBubble, { JudgeLine } from '../../components/SpeakingBubble';
import { Empty } from '../../components/States';
import { exitTrial, exitTrialOnUnload, fetchTrialStatus, requestVerdict } from '../../api/trials';
import { submitSpeaking } from '../../api/speaking';
import { clearTrialHandoff, peekTrialHandoff } from '../../store/trialHandoff';
import { useAuth } from '../../store/auth';
import { MODE_NAME, ROLE_NAME, josa, opposite, resultColor, resultName, roleColor, scoreColor, scoreText, tierColor } from '../../lib/court';
import { isBlank, javaLength } from '../../lib/text';
import { initialState, isFinishedStatus, reducer } from './trialState';
import styles from './TrialPage.module.css';

const MAX_CONTENT = 300; // Java length
// 겁쟁이 모드 카드 패널: 단계마다 어느 공방의 카드인지 표시
const CARD_PANEL_TAG = { OPENING: '첫 공방 카드', CARD: '현재 공방', CLOSING: '마지막 공방 카드' };

function stageLabel(info, phase) {
  if (phase === 'verdict' || phase === 'verdicting' || phase === 'ready-verdict') return phase === 'ready-verdict' ? '최후 변론 종료' : '판결';
  if (info.stage === 'OPENING') return '모두 진술';
  if (info.stage === 'CLOSING') return '최후 변론';
  if (info.stage === 'CARD') {
    const card = info.cardNo ? `공방 · ${info.cardNo}번째 카드` : '공방';
    return info.exchangeNo ? `${card} · ${info.exchangeNo} / 3` : card;
  }
  return '';
}

function separatorText(mark, maxCard) {
  if (mark.stage === 'OPENING') return ['모두 진술', '검사 → 변호인 1번씩'];
  if (mark.stage === 'CLOSING') return ['최후 변론', maxCard >= 3 ? '3장 공방 후 진행 · 검사 → 변호인' : '2장 공방 후 게이지 47~53이 아니라 3번째 카드 없이 진행'];
  const title = mark.topic ? `논점 ${mark.cardNo ?? ''} : ${mark.topic}` : `논점 ${mark.cardNo ?? ''}`;
  if (mark.cardNo === 3) return [title, '논점 2개 후 게이지 47~53 · 공격과 반론 3번씩'];
  return [title, '공격과 반론 3번씩'];
}

export default function TrialPage() {
  const { workId, caseId } = useParams();
  const [handoff] = useState(() => peekTrialHandoff(caseId));
  if (!handoff) return <TrialGone workId={workId} caseId={caseId} />;
  return <TrialRoom handoff={handoff} workId={workId} caseId={caseId} />;
}

// 새로고침 · 직접 접근 등으로 진행 상태가 없을 때 (재판 이탈 정책: 이어가기 없음)
function TrialGone({ workId, caseId, reason }) {
  return (
    <Page width="content">
      <Empty
        title="재판이 종료되어 이어갈 수 없음"
        actions={
          <>
            <Button variant="secondary" to={`/works/${workId}`}>
              작품으로
            </Button>
            <Button to={`/works/${workId}/cases/${caseId}/setup`}>재판 준비로</Button>
          </>
        }
      >
        {reason === 'gone'
          ? '서버에서 진행 중인 재판을 찾을 수 없음(30분 무활동 · 다른 재판 시작 · 서버 재시작) · 기록은 저장되지 않음'
          : '재판 화면을 벗어나면(나가기 · 이동 · 뒤로 가기 · 새로고침 · 탭 닫기) 그 판은 기록 없이 끝남 · 같은 역할로 처음부터 다시 시작 가능'}
      </Empty>
    </Page>
  );
}

function TrialRoom({ handoff, workId, caseId }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [state, dispatch] = useReducer(reducer, handoff, initialState);
  const [draft, setDraft] = useState('');
  const [inputError, setInputError] = useState(null);
  const [exitOpen, setExitOpen] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [reveal, setReveal] = useState(0);
  const [announce, setAnnounce] = useState('');
  const abortRef = useRef(null);
  const leavingRef = useRef(false);
  const stateRef = useRef(state);
  const textareaRef = useRef(null);
  const hasToken = useAuth((s) => !!s.token);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const { role, mode, liveTrialId, phase } = state;
  const iron = mode === 'IRON';
  const info = handoff.info;
  const active = phase !== 'verdict' && phase !== 'ended';

  // 진행 중 판을 떠나는 모든 앱 안 이동(헤더 · 뒤로 가기 · 로그아웃)은 확인 팝업을 거친다
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (leavingRef.current || !hasToken) return false;
    const s = stateRef.current;
    if (s.phase === 'verdict' || s.phase === 'ended') return false;
    return currentLocation.pathname !== nextLocation.pathname;
  });

  const syncStatus = useCallback(
    async (nextPhase) => {
      try {
        const status = await fetchTrialStatus(stateRef.current.liveTrialId);
        dispatch({ type: 'synced', status, nextPhase: nextPhase ?? (isFinishedStatus(status) ? 'ready-verdict' : 'idle') });
        return status;
      } catch (err) {
        if (err.status === 404 || err.status === 403) dispatch({ type: 'ended', reason: 'gone' });
        throw err;
      }
    },
    [],
  );

  // 변호인 시작: 서버가 만든 검사 모두 진술의 판정 · 게이지를 상태 조회로 맞춘다(AI 재호출 없음)
  useEffect(() => {
    if (handoff.start.openingSpeaking) syncStatus('idle').catch(() => {});
    // 겁쟁이 검사 시작: 모두 진술 중에도 첫 공방 카드를 보여 주기 위해 카드만 받아 온다
    else if (handoff.mode === 'CHICKEN') {
      fetchTrialStatus(handoff.start.trialId).then((status) => dispatch({ type: 'card', status })).catch(() => {});
    }
  }, [handoff, syncStatus]);

  // 새로고침 · 탭 닫기: 경고 후 실제로 떠날 때 최선 노력으로 나가기 요청
  useEffect(() => {
    if (!active) return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    const onPageHide = () => {
      if (!leavingRef.current) exitTrialOnUnload(stateRef.current.liveTrialId);
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [active]);

  // 화면을 떠나면 스트림을 끊는다(서버는 그 턴을 반영하지 않음). 진행 중이었다면 나가기 요청도 보낸다.
  useEffect(
    () => () => {
      abortRef.current?.abort();
      const s = stateRef.current;
      if (!leavingRef.current && s.phase !== 'verdict' && s.phase !== 'ended') {
        exitTrial(s.liveTrialId).catch(() => {});
      }
      clearTrialHandoff(s.liveTrialId);
    },
    [],
  );

  useEffect(() => {
    if (blocker.state === 'blocked') setExitOpen(true);
  }, [blocker.state]);

  // 판결 공개 연출: 바늘 이동 → 판결 · 형량 → 내 결과
  useEffect(() => {
    if (phase !== 'verdict') return undefined;
    const t1 = setTimeout(() => setReveal(1), 250);
    const t2 = setTimeout(() => setReveal(2), 1700);
    const t3 = setTimeout(() => setReveal(3), 2700);
    return () => [t1, t2, t3].forEach(clearTimeout);
  }, [phase]);

  const leave = async () => {
    setExiting(true);
    leavingRef.current = true;
    abortRef.current?.abort();
    try {
      await exitTrial(liveTrialId); // 이미 없어도 204 · 실패해도 이동은 막지 않는다
    } catch {
      // 서버에 남은 판은 30분 무활동 또는 새 판 시작으로 정리된다
    }
    clearTrialHandoff(liveTrialId);
    dispatch({ type: 'ended', reason: 'left' });
    setExitOpen(false);
    if (blocker.state === 'blocked') blocker.proceed();
    else navigate(`/works/${workId}`);
  };

  const cancelExit = () => {
    if (exiting) return;
    setExitOpen(false);
    if (blocker.state === 'blocked') blocker.reset();
  };

  const send = async () => {
    const s = stateRef.current;
    if (s.phase !== 'idle' || abortRef.current || s.fail?.retryable === false) return; // 중복 제출 방지
    if (isBlank(draft) || javaLength(draft) > MAX_CONTENT) {
      setInputError('발언은 1자 이상 300자 이하로 입력해 주세요.');
      return;
    }
    const content = draft;
    setInputError(null);
    setDraft('');
    dispatch({ type: 'send', content });
    setAnnounce('발언 제출 · 판사가 판단하는 중');
    const controller = new AbortController();
    abortRef.current = controller;
    const before = s.speakings.length;
    let nextTurn = null;
    try {
      const result = await submitSpeaking(s.liveTrialId, content, {
        signal: controller.signal,
        handlers: {
          judge: (data) => dispatch({ type: 'judge', data }),
          opponent_delta: (data) => dispatch({ type: 'delta', text: data.text }),
          opponent_judge: (data) => {
            dispatch({ type: 'oppJudge', data });
            setAnnounce(`AI ${ROLE_NAME[opposite(role)]} 발언 완료`);
          },
          stage: (data) => dispatch({ type: 'stage', data }),
          turn_done: (data) => {
            nextTurn = data.nextTurn;
          },
        },
      });
      if (result.turnDone) {
        const nextPhase = nextTurn === 'VERDICT' ? 'ready-verdict' : 'idle';
        dispatch({ type: 'phase', phase: 'syncing' });
        // 카드 안 공방 번호는 stage 이벤트로 오지 않아 상태 조회로 맞춘다
        try {
          await syncStatus(nextPhase);
        } catch (err) {
          if (err.status !== 404 && err.status !== 403) dispatch({ type: 'commitLocal', nextPhase });
        }
        setAnnounce(nextPhase === 'ready-verdict' ? '최후 변론 종료 · 판결 차례' : '내 차례');
        return;
      }
      if (result.error) {
        dispatch({ type: 'discard', fail: result.error });
        setDraft((current) => current || content); // 대기 중 새로 쓴 발언은 덮어쓰지 않는다.
        setAnnounce('발언이 반영되지 않음');
        return;
      }
      // turn_done 도 error 도 없이 끊김: 서버 상태로 확인
      await recoverAfterCut(before, content);
    } catch (err) {
      if (err?.name === 'AbortError') return;
      if (err.status === 404 || err.status === 403) {
        dispatch({ type: 'ended', reason: 'gone' });
        return;
      }
      if (err.businessCode === 'SPEAKING_NOT_YOUR_TURN') {
        dispatch({ type: 'discard', fail: err });
        setDraft((current) => current || content);
        syncStatus().catch(() => {});
        return;
      }
      if (err.businessCode === 'NETWORK_ERROR' && stateRef.current.temp) {
        await recoverAfterCut(before, content);
        return;
      }
      dispatch({ type: 'discard', fail: err });
      setDraft((current) => current || content);
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  const recoverAfterCut = async (before, content) => {
    try {
      const status = await fetchTrialStatus(stateRef.current.liveTrialId);
      if ((status.speakings ?? []).length > before) {
        dispatch({ type: 'synced', status, nextPhase: isFinishedStatus(status) ? 'ready-verdict' : 'idle' });
        return;
      }
      dispatch({ type: 'discard', fail: { message: '연결이 끊겨 이번 발언은 반영되지 않았습니다. 같은 발언을 다시 보내 주세요.' } });
      setDraft((current) => current || content);
    } catch (err) {
      if (err.status === 404 || err.status === 403) {
        dispatch({ type: 'ended', reason: 'gone' });
        return;
      }
      dispatch({ type: 'discard', fail: { message: '연결이 끊겨 서버 상태를 확인하지 못했습니다. 같은 발언을 다시 보내 주세요.' } });
      setDraft((current) => current || content);
    }
  };

  const judge = async () => {
    if (stateRef.current.phase !== 'ready-verdict') return; // 중복 호출 방지
    dispatch({ type: 'verdictStart' });
    try {
      const verdict = await requestVerdict(liveTrialId);
      clearTrialHandoff(liveTrialId);
      dispatch({ type: 'verdict', verdict });
      setAnnounce(`판결 ${verdict.title} · ${resultName(role, verdict.penaltyTier)}`);
      ['workCases', 'setup', 'caseRecords', 'myTrials', 'myStats'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    } catch (err) {
      if (err.status === 404) {
        dispatch({ type: 'ended', reason: 'gone' });
        return;
      }
      if (err.businessCode === 'VERDICT_STAGE_INVALID') syncStatus().catch(() => {});
      dispatch({ type: 'verdictError', error: err });
    }
  };

  if (phase === 'ended' && state.ended === 'gone') return <TrialGone workId={workId} caseId={caseId} reason="gone" />;

  const myTurn = phase === 'idle';
  const fail = state.fail;
  const failCount = typeof fail?.failCount === 'number' ? fail.failCount : 0;
  const retryBlocked = fail?.retryable === false;
  const verdict = state.verdict;
  const finalScore = verdict ? verdict.score : null;
  const opp = opposite(role);

  // 대화 기록 + 단계 구분선
  const rows = [];
  state.speakings.forEach((sp) => {
    const mark = state.marks[sp.seq];
    if (mark) rows.push({ type: 'sep', key: `sep-${sp.seq}`, text: separatorText(mark, state.maxCard) });
    rows.push({ type: 'talk', key: `sp-${sp.seq}`, sp });
  });
  if (state.temp) {
    const t = state.temp;
    if (state.marks[t.mySeq]) rows.push({ type: 'sep', key: `sep-${t.mySeq}`, text: separatorText(state.marks[t.mySeq], state.maxCard) });
    rows.push({ type: 'temp-mine', key: 'temp-mine', t });
    if (t.opp) {
      if (state.marks[t.mySeq + 1]) rows.push({ type: 'sep', key: `sep-${t.mySeq + 1}`, text: separatorText(state.marks[t.mySeq + 1], state.maxCard) });
      rows.push({ type: 'temp-opp', key: 'temp-opp', t });
    }
  }

  const stageIdx = phase === 'verdict' || phase === 'verdicting' || phase === 'ready-verdict' ? 5 : state.stageInfo.stage === 'OPENING' ? 0 : state.stageInfo.stage === 'CARD' ? state.stageInfo.cardNo ?? 1 : 4;
  const stages = [
    { name: '모두 진술', i: 0 },
    { name: '공방 · 1번째 카드', i: 1 },
    { name: '공방 · 2번째 카드', i: 2 },
    { name: '공방 · 3번째 카드 (47~53일 때)', i: 3 },
    { name: '최후 변론', i: 4 },
    { name: '판결', i: 5 },
  ].map((st) => {
    const now = st.i === stageIdx;
    const skipped = st.i === 3 && stageIdx >= 4 && state.maxCard < 3;
    const done = st.i < stageIdx && !skipped;
    return { ...st, now, label: now ? '진행 중' : skipped ? '없음' : done ? '끝' : '' };
  });

  const turnTitle = stageLabel(state.stageInfo, 'idle');
  const turnSub =
    role === 'DEFENSE'
      ? state.stageInfo.stage === 'CLOSING'
        ? '검사 최후 변론에 맞서 공방을 종합한 결론'
        : 'AI 검사 발언에 반론'
      : state.stageInfo.stage === 'OPENING'
        ? '검사 모두 진술로 시작'
        : state.stageInfo.stage === 'CLOSING'
          ? '공방을 종합한 결론'
          : '이번 카드로 공격';
  const working = phase === 'sending' || phase === 'syncing';
  const workTitle = state.temp?.opp ? `AI ${josa(ROLE_NAME[opp], '이', '가')} 발언하는 중` : state.temp?.mine?.judge ? `AI ${josa(ROLE_NAME[opp], '이', '가')} 발언을 준비하는 중` : phase === 'syncing' ? '재판 상태를 맞추는 중' : '판사가 내 발언을 판단하는 중';

  return (
    <Page gap="sm" className={styles.page}>
      <div className="sr-only" aria-live="polite">
        {announce}
      </div>
      <section className={styles.top}>
        <div className={styles.topText}>
          <div className={styles.meta}>
            {info.workTitle ? `${info.workTitle} · ` : ''}피의자 {info.suspect}
          </div>
          <h1 className={styles.h1}>{info.question}</h1>
        </div>
        <div className={styles.topRight}>
          <div className={styles.kv}>
            <span className={styles.k}>내 역할 · 모드</span>
            <span className={styles.v} style={{ color: roleColor(role) }}>
              {ROLE_NAME[role]} · {MODE_NAME[mode]}
            </span>
          </div>
          <div className={styles.kv}>
            <span className={styles.k}>진행 단계</span>
            <span className={styles.v}>{stageLabel(state.stageInfo, phase)}</span>
          </div>
          {active ? (
            <Button variant="secondary" size="lg" onClick={() => setExitOpen(true)}>
              <Icon name="exit" size="md" />
              나가기
            </Button>
          ) : (
            <Button variant="secondary" size="lg" to={`/works/${workId}`}>
              작품으로
            </Button>
          )}
        </div>
      </section>

      <div className={styles.body}>
        <section className={styles.chat}>
          <div className={styles.logScroll}>
            <div className={styles.log}>
              {rows.map((r) => {
                if (r.type === 'sep') {
                  return (
                    <div key={r.key} className={styles.sep}>
                      <span className={styles.sepTitle}>{r.text[0]}</span>
                      <span className={styles.sepSub}>{r.text[1]}</span>
                    </div>
                  );
                }
                if (r.type === 'talk') {
                  const mine = r.sp.side === role;
                  const judged = r.sp.judge !== null;
                  return (
                    <SpeakingBubble key={r.key} side={r.sp.side} mine={mine} text={r.sp.content}>
                      {judged && !iron ? <JudgeLine judge={r.sp.judge} align={mine ? 'end' : 'start'} /> : null}
                      {judged && iron ? <div className={styles.ironNote}>판사 메모 완료 · 철인 모드라 판정은 판결 때 공개</div> : null}
                    </SpeakingBubble>
                  );
                }
                if (r.type === 'temp-mine') {
                  const j = r.t.mine.judge;
                  return (
                    <SpeakingBubble key={r.key} side={role} mine text={r.t.mine.content}>
                      {j && !iron ? <JudgeLine judge={j} align="end" /> : null}
                      {j && iron ? <div className={styles.ironNote}>판사 메모 완료 · 철인 모드라 판정은 판결 때 공개</div> : null}
                      {!j ? <div className={styles.pending}>판사가 판단하는 중…</div> : null}
                    </SpeakingBubble>
                  );
                }
                const j = r.t.opp.judge;
                return (
                  <SpeakingBubble key={r.key} side={opp} mine={false} text={r.t.opp.text} streaming={!j}>
                    {j && !iron ? <JudgeLine judge={j} /> : null}
                    {j && iron ? <div className={styles.ironNote}>판사 메모 완료 · 철인 모드라 판정은 판결 때 공개</div> : null}
                  </SpeakingBubble>
                );
              })}
            </div>
          </div>

          {phase === 'verdict' || phase === 'verdicting' ? (
            <div className={styles.verdictWrap}>
              <div className={styles.verdict}>
                <div className={styles.verdictLabel}>AI 판사 · 판결</div>
                <Gauge
                  score={reveal >= 1 && verdict ? finalScore : 50}
                  needleColor={verdict && reveal >= 1 ? (finalScore <= 50 ? 'var(--def)' : 'var(--pro)') : 'var(--text-1b)'}
                  middle={!verdict || reveal < 2 ? '판사가 판결문을 읽는 중…' : `최종 게이지 ${finalScore}`}
                  describe={!!verdict && reveal >= 2}
                />
                {verdict && reveal >= 2 ? (
                  <div className={styles.verdictTitleRow}>
                    <div className={styles.verdictTitle} style={{ color: tierColor(verdict.penaltyTier) }}>
                      {verdict.title}
                    </div>
                    <div className={styles.verdictSentence}>{verdict.sentence}</div>
                  </div>
                ) : null}
                {verdict && reveal >= 3 ? (
                  <>
                    <div className={styles.outcome}>
                      <span className={styles.k}>내 결과</span>
                      <span className={styles.outcomeName} style={{ color: resultColor(role, verdict.penaltyTier) }}>
                        {resultName(role, verdict.penaltyTier)}
                      </span>
                      <span className={styles.outcomeSub}>
                        {ROLE_NAME[role]} · {MODE_NAME[mode]} 모드
                      </span>
                    </div>
                    <div className={styles.verdictBtns}>
                      {verdict.oppositeAvailable ? (
                        <Button variant="secondary" size="xl" to={`/works/${workId}/cases/${caseId}/setup`}>
                          <Icon name="retry" size="md" />
                          {josa(ROLE_NAME[opp], '으로', '로')} 다시하기
                        </Button>
                      ) : (
                        <span className={styles.oppDone}>{ROLE_NAME[opp]} 역할 기록 있음 · 다시하기 불가</span>
                      )}
                      <Button size="xl" to={`/works/${workId}/cases/${caseId}/records?role=${role}`}>
                        <Icon name="record" size="md" />
                        기록 보기
                      </Button>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}

          {myTurn || working ? (
            <div className={styles.inputArea}>
              {fail ? (
                <div className={styles.fail} role="alert">
                  <div className={styles.failText}>
                    <span className={styles.failTitle}>{fail.message || '발언이 반영되지 않았습니다.'}</span>
                    <span className={styles.failSub}>
                      {retryBlocked
                        ? 'AI 설정 문제라 다시 보내도 진행할 수 없음 · 재판에서 나가기를 추천 (나가면 초기화)'
                        : failCount >= 3
                          ? `${failCount}번 연속 실패 · 재판에서 나가기를 추천 (나가면 초기화) · 계속하려면 다시 보내기`
                          : `이번 발언은 저장되지 않았고 게이지도 그대로 · 같은 발언을 다시 보내기${failCount ? ` (${failCount} / 3)` : ''}`}
                    </span>
                  </div>
                  {failCount >= 3 || retryBlocked ? (
                    <Button variant="dangerOutline" size="lg" onClick={() => setExitOpen(true)}>
                      재판 나가기
                    </Button>
                  ) : null}
                </div>
              ) : null}
              <div className={styles.turn}>
                <span className={styles.turnTitle}>{turnTitle}</span>
                <span className={styles.turnSub}>{turnSub}</span>
              </div>
              <form
                className={styles.inputRow}
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
                }}
              >
                <div className={styles.inputBox}>
                  <label htmlFor="speech" className={styles.inputLabel}>
                    <span>내 발언</span>
                    <span className={javaLength(draft) > MAX_CONTENT ? styles.over : undefined}>
                      {javaLength(draft)} / 300자
                    </span>
                  </label>
                  <textarea
                    id="speech"
                    ref={textareaRef}
                    rows={3}
                    maxLength={MAX_CONTENT}
                    className={styles.textarea}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      // 한글 조합 확정 Enter는 전송하지 않는다.
                      if (e.key !== 'Enter' || e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) return;
                      if (e.shiftKey) return; // Shift+Enter: 기본 줄바꿈
                      e.preventDefault();
                      if (e.ctrlKey || e.metaKey) {
                        // Ctrl+Enter: 기본 동작이 없어 커서 위치에 직접 줄바꿈을 넣는다.
                        const el = e.currentTarget;
                        const { selectionStart: start, selectionEnd: end } = el;
                        setDraft(el.value.slice(0, start) + '\n' + el.value.slice(end));
                        requestAnimationFrame(() => el.setSelectionRange(start + 1, start + 1));
                        return;
                      }
                      if (!e.repeat) send();
                    }}
                    aria-invalid={!!inputError || undefined}
                    aria-describedby={inputError ? 'speech-error' : undefined}
                  />
                  {inputError ? (
                    <span id="speech-error" className={styles.inputError}>
                      {inputError}
                    </span>
                  ) : null}
                </div>
                <Button type="submit" size="xl" disabled={retryBlocked || working}>
                  {fail ? '다시 보내기' : '보내기'}
                </Button>
              </form>
            </div>
          ) : null}

          {working ? (
            <div className={styles.working} role="status">
              <span className={styles.dot} style={{ background: state.temp?.opp ? 'var(--pro)' : 'var(--link)' }} aria-hidden="true" />
              <span className={styles.workTitle}>{workTitle}</span>
              <span className={styles.workSub}>AI를 세 번 부르므로 시간이 걸릴 수 있음</span>
            </div>
          ) : null}

          {phase === 'ready-verdict' ? (
            <div className={styles.verdictBar}>
              <div className={styles.verdictBarText}>
                최후 변론 종료 · 판결 차례
                {state.verdictError ? (
                  <span className={styles.verdictErr} role="alert">
                    {state.verdictError.message} · 다시 요청 가능
                  </span>
                ) : null}
              </div>
              <Button size="xl" onClick={judge}>
                판결 받기
              </Button>
            </div>
          ) : null}
          {phase === 'verdicting' ? (
            <div className={styles.working} role="status">
              <span className={styles.dot} style={{ background: 'var(--link)' }} aria-hidden="true" />
              <span className={styles.workTitle}>판사가 판결문을 쓰는 중</span>
              <span className={styles.workSub}>AI 총평 때문에 몇 초 걸릴 수 있음</span>
            </div>
          ) : null}
        </section>

        <aside className={styles.aside}>
          {!iron ? (
            <div className={styles.panel}>
              <div className={styles.panelHead}>
                <h2 className={styles.h2}>판사 게이지</h2>
                {typeof state.score === 'number' ? (
                  <span className={styles.score} style={{ color: scoreColor(state.score) }}>
                    {state.score}
                  </span>
                ) : null}
              </div>
              <Gauge score={typeof state.score === 'number' ? state.score : undefined} middle="50 · 동점이면 무죄" />
              {typeof state.score === 'number' ? (
                <div className={styles.meterText} style={{ color: scoreColor(state.score) }}>
                  {scoreText(state.score)}
                </div>
              ) : null}
            </div>
          ) : (
            <div className={styles.ironPanel}>철인 모드 · 판사 게이지와 발언별 판정은 판결 때 공개</div>
          )}

          {state.topic ? (
            <div className={styles.panel}>
              <h2 className={styles.h2}>현재 공방 논점</h2>
              <p className={styles.progress}>{state.topic}</p>
            </div>
          ) : null}

          {mode === 'CHICKEN' ? (
            <div className={styles.panel}>
              <div className={styles.panelHead}>
                <h2 className={styles.h2}>내 쪽 근거 카드</h2>
                <span className={styles.panelTag}>{CARD_PANEL_TAG[state.stageInfo.stage] ?? '겁쟁이 모드'}</span>
              </div>
              {state.card ? (
                <EvidenceCard side={state.card.side} title={state.card.title} body={state.card.body}
                  weight={state.card.roundWeight} weightLabel="공방 가중치" />
              ) : (
                <p className={styles.workSub}>이 논점에 직접 대응하는 내 쪽 근거 카드가 없어.</p>
              )}
            </div>
          ) : null}

          {mode === 'CHALLENGER' && state.progress ? (
            <div className={styles.panel}>
              <div className={styles.panelHead}>
                <h2 className={styles.h2}>사건 경과</h2>
                <span className={styles.panelTag}>도전자 모드</span>
              </div>
              <p className={styles.progress}>{state.progress}</p>
            </div>
          ) : null}

          <div className={styles.panel}>
            <h2 className={styles.h2}>진행 단계</h2>
            <ol className={styles.stages}>
              {stages.map((st) => (
                <li key={st.name} className={`${styles.stage} ${st.now ? styles.stageNow : ''}`} aria-current={st.now ? 'step' : undefined}>
                  <span>{st.name}</span>
                  <span className={styles.stageState}>{st.label}</span>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>

      <Modal
        open={exitOpen}
        tone="danger"
        title="재판 나가기"
        onClose={cancelExit}
        busy={exiting}
        actions={
          <>
            <Button variant="secondary" size="xl" onClick={cancelExit} disabled={exiting} data-autofocus>
              계속하기
            </Button>
            <Button variant="danger" size="xl" onClick={leave} loading={exiting}>
              초기화하고 나가기
            </Button>
          </>
        }
      >
        <div className={styles.exitBody}>
          지금 나가시면 이번 재판은 <b>초기화</b>되며, 진행하신 내용은 저장되지 않습니다.
        </div>
      </Modal>
    </Page>
  );
}
