import { create } from 'zustand';

// 로그인 결과는 탭을 닫으면 사라지는 sessionStorage에만 둔다. 토큰 갱신 API가 없어 만료(1시간) 후엔 다시 로그인.
const KEY = 'cc-auth';

function load() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw);
    return value && value.token ? value : null;
  } catch {
    return null;
  }
}

function save(value) {
  try {
    if (value) sessionStorage.setItem(KEY, JSON.stringify(value));
    else sessionStorage.removeItem(KEY);
  } catch {
    // 저장소 차단: 메모리 상태만 쓴다
  }
}

const initial = load();

export const useAuth = create((set) => ({
  token: initial?.token ?? null,
  nickname: initial?.nickname ?? null,
  authority: initial?.authority ?? null,
  notice: null, // 401 로 로그아웃될 때 로그인 화면에 보여 줄 서버 메시지
  login: ({ token, nickname, authority }) => {
    save({ token, nickname, authority });
    set({ token, nickname, authority, notice: null });
  },
  logout: (notice = null) => {
    save(null);
    set({ token: null, nickname: null, authority: null, notice });
  },
}));

export const isAdminAuthority = (authority) => authority === 'ADMIN' || authority === 'SUPER_ADMIN';
export const isSuperAuthority = (authority) => authority === 'SUPER_ADMIN';

export function getToken() {
  return useAuth.getState().token;
}
