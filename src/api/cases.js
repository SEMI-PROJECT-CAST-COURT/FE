import { http, unwrap } from './client';

// 관리자 사건 목록도 이 API를 쓴다(관리자 전용 목록 API 없음).
export const fetchWorkCases = (workId) => http.get(`/api/works/${workId}/cases`).then(unwrap);

export const fetchCaseSetup = (caseId) => http.get(`/api/cases/${caseId}/setup`).then(unwrap);

export const fetchAdminCase = (caseId) => http.get(`/api/admin/cases/${caseId}`).then(unwrap);

// HTTP 200 에 본문 statusCode 201, result = 새 caseId
export const createCase = (payload) => http.post('/api/admin/cases', payload).then(unwrap);

export const updateCase = (caseId, payload) =>
  http.put(`/api/admin/cases/${caseId}`, payload).then(() => undefined);

export const deleteCase = (caseId) => http.delete(`/api/admin/cases/${caseId}`).then(() => undefined);
