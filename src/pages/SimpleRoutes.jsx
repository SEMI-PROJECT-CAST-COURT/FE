import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router';
import Footer from '../components/Footer';
import { Page } from '../components/Layout';
import { Empty } from '../components/States';
import Button from '../components/Button';
import { useAuth } from '../store/auth';
import { queryClient } from '../queryClient';

// 로그인 화면은 헤더 없이 푸터만 둔다(시안 "로그인 · 회원가입").
export function AuthLayout() {
  return (
    <>
      <div id="main" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Outlet />
      </div>
      <Footer />
    </>
  );
}

// 로그아웃 API는 없다. 클라이언트 인증과 서버 데이터 캐시만 지운다.
export function LogoutRoute() {
  const logout = useAuth((s) => s.logout);
  useEffect(() => {
    logout();
    queryClient.clear();
  }, [logout]);
  return <Navigate to="/login" replace />;
}

export function NotFoundPage() {
  return (
    <Page>
      <Empty title="찾을 수 없는 화면" actions={<Button to="/works">작품 목록으로</Button>}>
        주소를 확인해 주세요.
      </Empty>
    </Page>
  );
}
