import { inRange, isBlank, javaLength, strip } from '../../lib/text';

// 사건 · 카드 · 형벌표 검증은 서버(WorkCaseService · EvidenceCardService · PenaltyTierService)와 같은 Java length 기준
export const LIMITS = { question: 100, suspect: 50, victim: 50, summary: 1000, progress: 1000, cardTitle: 20, cardBody: 100, sentence: 50 };

export const CASE_FIELDS = ['question', 'suspect', 'victim', 'summary', 'progress'];

let seq = 0;
export const newKey = () => `k${(seq += 1)}`;

export function fieldError(name, value) {
  if (isBlank(value)) return '필수 입력';
  if (javaLength(value) > LIMITS[name]) return `${LIMITS[name]}자 이하`;
  return null;
}

export function caseFieldsValid(form) {
  return CASE_FIELDS.every((f) => !fieldError(f, form[f]));
}

export function cardErrors(card) {
  const e = {};
  if (!inRange(card.title, LIMITS.cardTitle)) e.title = isBlank(card.title) ? '제목 필수' : '제목 20자 이하';
  if (!inRange(card.body, LIMITS.cardBody)) e.body = isBlank(card.body) ? '내용 필수' : `내용 ${LIMITS.cardBody}자 이하`;
  const w = Number(card.weight);
  if (!Number.isInteger(w) || w < 1 || w > 20) e.weight = '가중치 1~20 정수';
  return e;
}

export function penaltyError(sentence) {
  if (isBlank(sentence)) return '필수 입력';
  if (javaLength(sentence) > LIMITS.sentence) return '50자 이하';
  return null;
}

// AI 요청에 넣을 공통 사건 필드 (서버가 strip 해서 검사)
export function commonFields(form) {
  return CASE_FIELDS.reduce((acc, f) => ({ ...acc, [f]: form[f] }), {});
}

// 화면의 다른 카드 (서버는 진영 · 제목 · 내용이 있는 카드만 받고 최대 20장)
export function otherCards(cards, exceptKey) {
  return cards
    .filter((c) => c.key !== exceptKey && !isBlank(c.title) && !isBlank(c.body))
    .slice(0, 20)
    .map((c) => ({ side: c.side, title: strip(c.title), body: strip(c.body), weight: Number(c.weight) || 0 }));
}

export function diffLevel(mine, theirs) {
  const d = mine - theirs;
  if (d >= 6) return 'EASY';
  if (d <= -6) return 'HARD';
  return 'NORMAL';
}

export function cardChanged(card) {
  if (!card.orig) return true;
  return card.title !== card.orig.title || card.body !== card.orig.body || Number(card.weight) !== card.orig.weight;
}
