// 화면 표시용 이름 · 매핑. 계산(게이지 · 난이도 · 형벌 단계 · 판정)은 서버 응답을 따른다.

export const ROLE = { DEFENSE: 'DEFENSE', PROSECUTION: 'PROSECUTION' };
export const ROLE_KEY = { DEFENSE: 'def', PROSECUTION: 'pro' };
export const KEY_ROLE = { def: 'DEFENSE', pro: 'PROSECUTION' };
export const ROLE_NAME = { DEFENSE: '변호인', PROSECUTION: '검사' };
export const opposite = (role) => (role === 'DEFENSE' ? 'PROSECUTION' : 'DEFENSE');

export const MODES = ['CHICKEN', 'CHALLENGER', 'IRON'];
export const MODE_NAME = { CHICKEN: '겁쟁이', CHALLENGER: '도전자', IRON: '철인' };

export const DIFFICULTY_NAME = { EASY: '쉬움', NORMAL: '보통', HARD: '어려움' };
export const DIFFICULTY_COLOR = { EASY: 'var(--win)', NORMAL: 'var(--link)', HARD: 'var(--danger)' };

// 서버 ScoreRule.tierTitle 과 같은 이름 (형벌표 행 제목에 쓴다. 판결 title 은 서버 값을 쓴다)
export const TIER_TITLES = ['무죄 3단계', '무죄 2단계', '무죄 1단계', '유죄 1단계', '유죄 2단계', '유죄 3단계'];
export const TIER_RANGES = ['0~16', '17~33', '34~50', '51~66', '67~83', '84~100'];

const DEFENSE_RESULTS = ['완승', '승리', '진땀승', '진땀패', '패배', '완패'];
const WIN_NAMES = ['완승', '승리', '진땀승'];

// 결과 이름은 서버가 보내지 않는다. 역할 + penaltyTier(1~6)로 화면에서 정한다.
export function resultName(role, tier) {
  if (!tier || tier < 1 || tier > 6) return '';
  return role === 'PROSECUTION' ? DEFENSE_RESULTS[6 - tier] : DEFENSE_RESULTS[tier - 1];
}

export function isWin(role, tier) {
  return role === 'DEFENSE' ? tier <= 3 : tier >= 4;
}

export const isWinName = (name) => WIN_NAMES.includes(name);

export const tierColor = (tier) => (tier <= 3 ? 'var(--def)' : 'var(--pro)');
export const resultColor = (role, tier) => (isWin(role, tier) ? 'var(--win)' : 'var(--pro)');
export const roleColor = (role) => (role === 'PROSECUTION' ? 'var(--pro)' : 'var(--def)');

// 역할 아이콘: 검사 = 돋보기(prosecution), 변호인 = 방패(defense), 판사 = 판사봉(judge)
export const roleIcon = (role) => (role === 'PROSECUTION' ? 'prosecution' : role === 'DEFENSE' ? 'defense' : 'judge');

export const GRADE = {
  STRONG: { name: '강함', color: 'var(--win)' },
  OK: { name: '보통', color: 'var(--link)' },
  WEAK: { name: '약함', color: 'var(--text-1b)' },
  OFF: { name: '무관', color: 'var(--text-3)' },
};

export const STAGE_NAME = { OPENING: '모두 진술', CARD: '공방', CLOSING: '최후 변론' };

export function scoreColor(score) {
  if (score === 50) return 'var(--text-1b)';
  return score < 50 ? 'var(--def)' : 'var(--pro)';
}

export function scoreText(score) {
  if (score === 50) return '팽팽함 · 지금 끝나면 무죄 1단계';
  if (score < 50) return score <= 33 ? '무죄 쪽 크게 우세' : '무죄 쪽 조금 우세';
  return score >= 67 ? '유죄 쪽 크게 우세' : '유죄 쪽 조금 우세';
}

// 받침에 맞는 조사: josa('변호인', '이', '가') → '변호인이', josa('검사', '으로', '로') → '검사로'
export function josa(word, withFinal, withoutFinal) {
  const code = (word ?? '').charCodeAt(word.length - 1) - 0xac00;
  const hasFinal = code >= 0 && code <= 11171 && code % 28 !== 0;
  return word + (hasFinal ? withFinal : withoutFinal);
}

export const formatDelta = (delta) => (delta > 0 ? `+${delta}` : delta < 0 ? `−${Math.abs(delta)}` : '0');
