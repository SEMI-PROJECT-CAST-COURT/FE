import { createBrowserRouter, Navigate } from 'react-router';
import Layout from './components/Layout';
import { RequireAdmin, RequireAuth, RequireSuper } from './components/Guards';
import AdminWorkPage from './pages/admin/AdminWorkPage';
import AdminCasePage from './pages/admin/AdminCasePage';
import AdminAccountsPage from './pages/admin/AdminAccountsPage';
import AuthPage from './pages/AuthPage';
import RulesPage from './pages/RulesPage';
import CreditsPage from './pages/CreditsPage';
import WorksPage from './pages/WorksPage';
import WorkDetailPage from './pages/WorkDetailPage';
import SetupPage from './pages/SetupPage';
import TrialPage from './pages/trial/TrialPage';
import RecordPage from './pages/RecordPage';
import MyRecordsPage from './pages/MyRecordsPage';
import { AuthLayout, LogoutRoute, NotFoundPage } from './pages/SimpleRoutes';

export const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [{ path: '/login', element: <AuthPage /> }],
  },
  { path: '/logout', element: <LogoutRoute /> },
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Navigate to="/works" replace /> },
      { path: '/rules', element: <RulesPage /> },
      { path: '/credits', element: <CreditsPage /> },
      {
        // 작품 목록부터 서버가 인증을 요구한다(GET /api/works 는 인증 필요).
        element: <RequireAuth />,
        children: [
          { path: '/works', element: <WorksPage /> },
          { path: '/works/:workId', element: <WorkDetailPage /> },
          { path: '/works/:workId/cases/:caseId/setup', element: <SetupPage /> },
          { path: '/works/:workId/cases/:caseId/trial', element: <TrialPage /> },
          { path: '/works/:workId/cases/:caseId/records', element: <RecordPage /> },
          { path: '/records/:recordId', element: <RecordPage /> },
          { path: '/me/records', element: <MyRecordsPage /> },
          {
            element: <RequireAdmin />,
            children: [
              { path: '/admin/works/new', element: <AdminWorkPage /> },
              { path: '/admin/works/:workId/edit', element: <AdminWorkPage /> },
              { path: '/admin/works/:workId/cases/new', element: <AdminCasePage /> },
              { path: '/admin/works/:workId/cases/:caseId/edit', element: <AdminCasePage /> },
            ],
          },
          {
            element: <RequireSuper />,
            children: [{ path: '/admin/accounts', element: <AdminAccountsPage /> }],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
