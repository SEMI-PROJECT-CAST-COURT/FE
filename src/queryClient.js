import { QueryClient } from '@tanstack/react-query';

// 실패 시 자동 재요청하지 않는다(서버 상태를 꾸미지 않고 사용자가 다시 시도).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false, staleTime: 15_000 },
    mutations: { retry: false },
  },
});
