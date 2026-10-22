import { Navigate, Outlet, useLocation } from 'react-router';
import { isAdminAuthority, isSuperAuthority, useAuth } from '../store/auth';
import { Page } from './Layout';
import { ErrorState } from './States';

const FORBIDDEN = { status: 403, businessCode: 'ACCESS_DENIED', message: '접근 권한이 없습니다.' };

export function RequireAuth() {
  const token = useAuth((s) => s.token);
  const location = useLocation();
  if (!token) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}

// 화면 숨김은 편의 처리. 서버도 403 ACCESS_DENIED 로 막는다.
export function RequireAdmin() {
  const authority = useAuth((s) => s.authority);
  if (!isAdminAuthority(authority)) {
    return (
      <Page>
        <ErrorState error={FORBIDDEN} />
      </Page>
    );
  }
  return <Outlet />;
}

export function RequireSuper() {
  const authority = useAuth((s) => s.authority);
  if (!isSuperAuthority(authority)) {
    return (
      <Page>
        <ErrorState error={FORBIDDEN} />
      </Page>
    );
  }
  return <Outlet />;
}
