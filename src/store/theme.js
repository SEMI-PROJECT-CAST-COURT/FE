import { create } from 'zustand';

// 테마는 브라우저에만 저장한다(계정·DB 저장 없음). index.html 의 초기 스크립트와 같은 규칙.
const THEME_KEY = 'cc-theme';
const CONTRAST_KEY = 'cc-contrast';
const query = '(prefers-color-scheme: light)';

function read(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 저장소 차단: 이번 화면에서만 적용
  }
}

function systemLight() {
  try {
    return window.matchMedia(query).matches;
  } catch {
    return false;
  }
}

export function applyTheme(pref, contrast) {
  const root = document.documentElement;
  const light = pref === 'light' || (pref === 'system' && systemLight());
  root.setAttribute('data-theme', light ? 'light' : 'dark');
  if (contrast === 'high') root.setAttribute('data-contrast', 'high');
  else root.removeAttribute('data-contrast');
}

const initialPref = ['system', 'light', 'dark'].includes(read(THEME_KEY, 'system')) ? read(THEME_KEY, 'system') : 'system';
const initialContrast = read(CONTRAST_KEY, 'normal') === 'high' ? 'high' : 'normal';

export const useTheme = create((set, get) => ({
  pref: initialPref,
  contrast: initialContrast,
  setPref: (pref) => {
    write(THEME_KEY, pref);
    applyTheme(pref, get().contrast);
    set({ pref });
  },
  toggleContrast: () => {
    const contrast = get().contrast === 'high' ? 'normal' : 'high';
    write(CONTRAST_KEY, contrast);
    applyTheme(get().pref, contrast);
    set({ contrast });
  },
}));

// OS 테마 변경과 다른 탭의 변경을 반영한다.
export function bindThemeListeners() {
  const sync = () => {
    const { pref, contrast } = useTheme.getState();
    applyTheme(pref, contrast);
  };
  let media;
  try {
    media = window.matchMedia(query);
    media.addEventListener('change', sync);
  } catch {
    media = null;
  }
  const onStorage = (e) => {
    if (e.key !== THEME_KEY && e.key !== CONTRAST_KEY) return;
    const pref = read(THEME_KEY, 'system');
    const contrast = read(CONTRAST_KEY, 'normal') === 'high' ? 'high' : 'normal';
    useTheme.setState({ pref, contrast });
    applyTheme(pref, contrast);
  };
  window.addEventListener('storage', onStorage);
  sync();
  return () => {
    media?.removeEventListener('change', sync);
    window.removeEventListener('storage', onStorage);
  };
}
