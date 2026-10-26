import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router';
import './styles/tokens.css';
import './styles/global.css';
import { router } from './router';
import { queryClient } from './queryClient';
import { setUnauthorizedHandler } from './api/client';
import { bindThemeListeners } from './store/theme';

// 인증된 요청이 401이면(만료 · 잘못된 토큰) 서버 캐시를 비우고 로그인으로 보낸다.
setUnauthorizedHandler(() => {
  queryClient.clear();
  router.navigate('/login', { replace: true });
});

bindThemeListeners();

// StrictMode 는 개발 중 effect 를 두 번 실행해 재판 나가기(DELETE) 같은 부수 효과를 중복 호출하므로 쓰지 않는다.
createRoot(document.getElementById('root')).render(
  <QueryClientProvider client={queryClient}>
    <RouterProvider router={router} />
  </QueryClientProvider>,
);
