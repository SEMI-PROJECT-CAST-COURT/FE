import { http, unwrap } from './client';

// 계정 API는 /api 가 붙지 않는다.
export const login = (username, password) =>
  http.post('/login', { username, password }, { skipAuth: true }).then(unwrap);

export const signupUser = ({ username, password, nickname }) =>
  http.post('/signup/user', { username, password, nickname }, { skipAuth: true }).then(unwrap);

export const signupAdmin = ({ username, password, nickname }) =>
  http.post('/signup/admin', { username, password, nickname }).then(unwrap);

export const fetchAdmins = () => http.get('/account/admin').then(unwrap);

export const deactivateAdmin = (id) => http.delete(`/admin/${id}`).then(unwrap);
