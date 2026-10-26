import { API_BASE_URL, http, unwrap } from './client';
import { getToken } from '../store/auth';

// 진행 중 trialId 는 서버 메모리의 UUID 문자열, 기록용 trialId 는 DB 정수다.
export const startTrial = ({ caseId, role, mode }) => http.post('/api/trials', { caseId, role, mode }).then(unwrap);

export const fetchTrialStatus = (liveTrialId) => http.get(`/api/trials/${liveTrialId}`).then(unwrap);

export const requestVerdict = (liveTrialId) => http.post(`/api/trials/${liveTrialId}/verdict`).then(unwrap);

export const exitTrial = (liveTrialId) => http.delete(`/api/trials/${liveTrialId}`).then(() => undefined);

// 페이지를 떠날 때(pagehide) 최선 노력으로 보낸다. 성공을 보장하지 않는다.
export function exitTrialOnUnload(liveTrialId) {
  const token = getToken();
  if (!liveTrialId || !token) return;
  try {
    fetch(`${API_BASE_URL}/api/trials/${encodeURIComponent(liveTrialId)}`, {
      method: 'DELETE',
      keepalive: true,
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  } catch {
    // 브라우저가 요청을 거절해도 이탈은 막지 않는다
  }
}

export const fetchTrialRecord = (recordId) => http.get(`/api/trials/${recordId}/record`).then(unwrap);

export const fetchCaseRecords = (caseId) => http.get(`/api/cases/${caseId}/records`).then(unwrap);

export function fetchMyTrials({ role, outcome, workId, cursor } = {}) {
  const params = {};
  if (role) params.role = role;
  if (outcome) params.outcome = outcome;
  if (workId) params.workId = workId;
  if (cursor) params.cursor = cursor;
  return http.get('/api/users/me/trials', { params }).then(unwrap);
}

export const fetchMyStats = () => http.get('/api/users/me/stats').then(unwrap);
