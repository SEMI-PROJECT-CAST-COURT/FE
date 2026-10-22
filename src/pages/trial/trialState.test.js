import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState, reducer } from './trialState.js';

const first = { cardId: 41, side: 'PROSECUTION', title: '현재 카드', body: '첫 근거', weight: 10 };
const second = { cardId: 77, side: 'PROSECUTION', title: '다음 카드', body: '둘째 근거', weight: 8 };
const handoff = (mode = 'CHICKEN', role = 'DEFENSE') => ({
  mode, role, start: { trialId: 'trial', stage: 'OPENING', cards: [first, second] },
});
const stage = (card, cardNo = 1) => ({ type: 'stage', data: { stage: 'CARD', cardNo, exchangeNo: 1, card } });
const send = { type: 'send', content: '발언' };

test('겁쟁이 시작 시 기존 전체 카드 응답을 표시 자료로 사용하지 않음', () => {
  const state = initialState(handoff());
  assert.equal(state.card, null);
  assert.equal(state.cards, undefined);
});

test('유저 역할과 관계없이 서버의 현재 카드 한 장만 사용하고 다음 카드로 교체', () => {
  for (const role of ['DEFENSE', 'PROSECUTION']) {
    let state = initialState(handoff('CHICKEN', role));
    state = reducer(state, send);
    state = reducer(state, stage(first));
    assert.deepEqual(state.card, first);
    assert.equal(state.card.side, 'PROSECUTION');
    state = reducer(state, stage(second, 2));
    assert.deepEqual(state.card, second);
    assert.equal(state.card.cardId, 77); // 공방 번호 2를 cardId로 추측하지 않음
    assert.equal(state.cards, undefined);
  }
});

test('도전자·철인은 응답에 카드가 있어도 원문 미표시', () => {
  for (const mode of ['CHALLENGER', 'IRON']) {
    let state = reducer(initialState(handoff(mode)), stage(first));
    assert.equal(state.card, null);
    state = reducer(state, { type: 'synced', status: { stage: 'CARD', cardNo: 1, card: first, speakings: [] } });
    assert.equal(state.card, null);
  }
});

test('상태 조회 결과로 현재 카드를 복원하고 모두 진술·최후 변론에서는 제거', () => {
  let state = initialState(handoff());
  state = reducer(state, { type: 'synced', status: { stage: 'CARD', cardNo: 2, card: second, speakings: [] } });
  assert.deepEqual(state.card, second);
  state = reducer(state, { type: 'synced', status: { stage: 'CLOSING', speakings: [] } });
  assert.equal(state.card, null);
  state = reducer(state, { type: 'stage', data: { stage: 'OPENING', card: first } });
  assert.equal(state.card, null);
});

test('AI 실패·연결 끊김으로 턴을 버리면 카드·단계·구분선·최대 카드 번호 복원', () => {
  let state = reducer(initialState(handoff()), stage(first));
  const confirmed = state;
  state = reducer(state, send);
  state = reducer(state, stage(second, 3));
  assert.deepEqual(state.card, second);
  assert.equal(state.maxCard, 3);
  state = reducer(state, { type: 'discard', fail: { code: 'AI_OPPONENT_FAILED' } });
  assert.deepEqual(state.card, confirmed.card);
  assert.deepEqual(state.stageInfo, confirmed.stageInfo);
  assert.deepEqual(state.marks, confirmed.marks);
  assert.equal(state.maxCard, confirmed.maxCard);
  assert.equal(state.temp, null);
});

test('turn_done 이후 상태 조회 실패로 로컬 확정해도 새 카드 유지', () => {
  let state = reducer(initialState(handoff()), stage(first));
  state = reducer(state, send);
  state = reducer(state, stage(second, 2));
  state = reducer(state, { type: 'delta', text: '새 카드 공격' });
  state = reducer(state, { type: 'commitLocal', nextPhase: 'idle' });
  assert.deepEqual(state.card, second);
  assert.equal(state.temp, null);
});

test('공방 종료 stage를 받은 즉시 현재 카드 제거', () => {
  let state = reducer(initialState(handoff()), stage(first));
  state = reducer(state, { type: 'stage', data: { stage: 'CLOSING' } });
  assert.equal(state.card, null);
});
