// 서버와 같은 방식으로 글자 수를 센다.
// codePoint(이모지 1자): 작품 제목 · 원작자 · 소개, 카테고리 이름, 소개 초안 입력
// Java length(UTF-16, 이모지 2자): 사건 · 카드 · 형벌표 · 발언 · AI 초안 요청

export const codePointLength = (value) => Array.from(value ?? '').length;
export const javaLength = (value) => (value ?? '').length;

// Java String.strip() 과 같은 공백 제거 (유니코드 공백 포함)
export const strip = (value) => (value ?? '').replace(/^\s+|\s+$/gu, '');
export const isBlank = (value) => strip(value).length === 0;

// 1~max 범위인지 (빈 값 · 공백만 → false)
export function inRange(value, max, counter = javaLength) {
  return !isBlank(value) && counter(value) <= max;
}

export function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).split('-');
  return y && m && d ? `${y}.${m}.${d}` : String(iso);
}

export function todayIso() {
  const d = new Date();
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
