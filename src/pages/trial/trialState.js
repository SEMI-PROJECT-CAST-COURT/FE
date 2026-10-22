// 재판 화면 상태(메모리 전용). 확정 상태는 서버 응답(시작 · turn_done 후 상태 조회)만 반영하고,
// 진행 중 턴(temp)은 turn_done 전까지 임시로만 그린다. error · 끊김이면 temp 를 버린다.

// 상태 API 발언 → 화면 발언 (비공개 필드는 키가 없으므로 0/false 로 채우지 않는다)
export function fromStatusSpeaking(s) {
  const judge = {};
  if ('issue' in s || 'evidence' in s || 'novel' in s) {
    // CHICKEN: 판정 공개. rebut 은 null(판정 제외)이면 NON_NULL 로 빠진다.
    judge.checks = { issue: s.issue, evidence: s.evidence, rebut: 'rebut' in s ? s.rebut : null, novel: s.novel };
  }
  if (s.grade) judge.grade = s.grade;
  if (typeof s.delta === 'number') judge.delta = s.delta;
  if (typeof s.scoreAfter === 'number') judge.scoreAfter = s.scoreAfter;
  return { seq: s.seq, stage: s.stage, side: s.side, speaker: s.speaker, content: s.content, judge };
}

// SSE judge 이벤트 data → 화면 판정 (IRON 은 {})
export function fromJudgeEvent(data) {
  const judge = {};
  if (data && typeof data === 'object') {
    if (data.checks && typeof data.checks === 'object') judge.checks = data.checks;
    if (data.grade) judge.grade = data.grade;
    if (typeof data.delta === 'number') judge.delta = data.delta;
    if (typeof data.scoreAfter === 'number') judge.scoreAfter = data.scoreAfter;
  }
  return judge;
}

export function initialState(handoff) {
  const { start, role, mode } = handoff;
  const speakings = [];
  if (start.openingSpeaking) {
    // 변호인으로 시작하면 서버가 시작 중에 만든 검사 모두 진술 (판정은 상태 조회로 맞춘다)
    speakings.push({ seq: 1, stage: 'OPENING', side: 'PROSECUTION', speaker: 'AI', content: start.openingSpeaking, judge: null });
  }
  return {
    phase: 'idle', // idle · sending · syncing · ready-verdict · verdicting · verdict · ended
    liveTrialId: start.trialId,
    role,
    mode,
    cards: Array.isArray(start.cards) ? start.cards : null,
    progress: typeof start.progress === 'string' ? start.progress : null,
    speakings,
    temp: null,
    stageInfo: { stage: start.stage ?? 'OPENING', cardNo: null, exchangeNo: null },
    marks: { 1: { stage: 'OPENING', cardNo: null } },
    maxCard: 0,
    score: mode === 'IRON' ? null : 50,
    fail: null,
    verdict: null,
    verdictError: null,
    ended: null,
  };
}

export function reducer(state, action) {
  switch (action.type) {
    case 'send':
      return { ...state, phase: 'sending', fail: null, temp: { mySeq: state.speakings.length + 1, mine: { content: action.content, judge: null }, opp: null } };
    case 'judge': {
      if (!state.temp) return state;
      const judge = fromJudgeEvent(action.data);
      return { ...state, temp: { ...state.temp, mine: { ...state.temp.mine, judge } }, score: typeof judge.scoreAfter === 'number' ? judge.scoreAfter : state.score };
    }
    case 'delta': {
      if (!state.temp) return state;
      const opp = state.temp.opp ?? { text: '', judge: null };
      return { ...state, temp: { ...state.temp, opp: { ...opp, text: opp.text + (action.text ?? '') } } };
    }
    case 'oppJudge': {
      if (!state.temp) return state;
      const judge = fromJudgeEvent(action.data);
      const opp = state.temp.opp ?? { text: '', judge: null };
      return { ...state, temp: { ...state.temp, opp: { ...opp, judge } }, score: typeof judge.scoreAfter === 'number' ? judge.scoreAfter : state.score };
    }
    case 'stage': {
      // 모든 단계에서 검사가 먼저 말하므로, 바뀐 단계는 다음 검사 발언부터 시작한다.
      // 사용자가 변호인이면 이번 턴의 AI 검사 발언, 검사면 사용자의 다음 발언.
      const data = action.data ?? {};
      const mySeq = state.temp?.mySeq ?? state.speakings.length + 1;
      const markSeq = state.role === 'DEFENSE' ? mySeq + 1 : mySeq + 2;
      const cardNo = typeof data.cardNo === 'number' ? data.cardNo : null;
      return {
        ...state,
        stageInfo: { stage: data.stage, cardNo, exchangeNo: typeof data.exchangeNo === 'number' ? data.exchangeNo : null },
        marks: { ...state.marks, [markSeq]: { stage: data.stage, cardNo } },
        maxCard: Math.max(state.maxCard, cardNo ?? 0),
      };
    }
    case 'synced': {
      const st = action.status;
      const speakings = (st.speakings ?? []).map(fromStatusSpeaking);
      const cardNo = typeof st.cardNo === 'number' ? st.cardNo : null;
      return {
        ...state,
        speakings,
        temp: null,
        score: typeof st.score === 'number' ? st.score : state.score,
        stageInfo: { stage: st.stage, cardNo, exchangeNo: typeof st.exchangeNo === 'number' ? st.exchangeNo : null },
        maxCard: Math.max(state.maxCard, cardNo ?? 0),
        phase: action.nextPhase ?? state.phase,
      };
    }
    case 'commitLocal': {
      // 상태 조회가 실패했을 때: turn_done 을 받은 턴을 임시 내용 그대로 확정
      if (!state.temp) return { ...state, phase: action.nextPhase };
      const t = state.temp;
      const mine = { seq: t.mySeq, side: state.role, speaker: 'USER', content: t.mine.content, judge: t.mine.judge };
      const list = [...state.speakings, mine];
      if (t.opp) list.push({ seq: t.mySeq + 1, side: state.role === 'DEFENSE' ? 'PROSECUTION' : 'DEFENSE', speaker: 'AI', content: t.opp.text, judge: t.opp.judge });
      return { ...state, speakings: list, temp: null, phase: action.nextPhase };
    }
    case 'discard':
      // 반영되지 않은 턴: 임시 상태를 버리고 마지막 확정 상태로. 게이지도 확정 발언 기준으로 되돌린다.
      return { ...state, temp: null, phase: 'idle', fail: action.fail ?? null, score: lastScore(state) };
    case 'phase':
      return { ...state, phase: action.phase };
    case 'verdictStart':
      return { ...state, phase: 'verdicting', verdictError: null };
    case 'verdictError':
      return { ...state, phase: 'ready-verdict', verdictError: action.error };
    case 'verdict':
      return { ...state, phase: 'verdict', verdict: action.verdict };
    case 'ended':
      return { ...state, phase: 'ended', ended: action.reason ?? 'gone', temp: null };
    default:
      return state;
  }
}

function lastScore(state) {
  if (state.mode === 'IRON') return null;
  for (let i = state.speakings.length - 1; i >= 0; i -= 1) {
    const s = state.speakings[i].judge?.scoreAfter;
    if (typeof s === 'number') return s;
  }
  return state.speakings.length === 0 ? 50 : state.score;
}

// 상태 조회만 있고 turn_done 이 없을 때 판결 차례인지: 최후 변론 2개가 모두 끝났는지 서버 발언으로 확인
export function isFinishedStatus(status) {
  return (status.speakings ?? []).filter((s) => s.stage === 'CLOSING').length >= 2;
}
