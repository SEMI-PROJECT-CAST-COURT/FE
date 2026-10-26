import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 백엔드 CORS · WebSocket 허용 출처가 http://localhost:5173 하나뿐이라 포트를 바꾸지 않는다.
export default defineConfig({
  plugins: [react()],
  server: {
    host: 'localhost',
    port: 5173,
    strictPort: true,
  },
});
