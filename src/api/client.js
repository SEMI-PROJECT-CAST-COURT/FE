import axios from 'axios';
import { getToken, useAuth } from '../store/auth';

// 서버 주소는 이 파일 한 곳에서만 관리한다. 포스터 · SSE · WebSocket 주소도 여기서 만든다.
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080').replace(/\/+$/, '');
export const WS_BASE_URL = API_BASE_URL.replace(/^http/, 'ws');

export class ApiError extends Error {
  constructor({ status, businessCode, message, retryable, failCount }) {
    super(message || '요청을 처리하지 못했습니다.');
    this.name = 'ApiError';
    this.status = status ?? 0;
    this.businessCode = businessCode ?? null;
    if (retryable !== undefined) this.retryable = retryable;
    if (failCount !== undefined) this.failCount = failCount;
  }
}

// 서버 오류 본문 { statusCode, businessCode, message } → ApiError
export function toApiError(status, body) {
  if (body && typeof body === 'object' && (body.businessCode || body.message)) {
    return new ApiError({ status, businessCode: body.businessCode, message: body.message });
  }
  if (!status) return new ApiError({ status: 0, businessCode: 'NETWORK_ERROR', message: '서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.' });
  return new ApiError({ status, businessCode: null, message: '요청을 처리하지 못했습니다.' });
}

let unauthorizedHandler = null;
export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

// 인증된 요청이 401이면 인증 상태를 비우고 로그인으로 보낸다. (로그인 요청의 401은 폼 오류로 처리)
export function handleUnauthorized(error) {
  if (error?.status !== 401) return;
  const had = !!useAuth.getState().token;
  useAuth.getState().logout(had ? error.message : null);
  if (had && unauthorizedHandler) unauthorizedHandler(error);
}

export const http = axios.create({ baseURL: API_BASE_URL });

http.interceptors.request.use((config) => {
  const token = getToken();
  if (token && !config.skipAuth) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status ?? 0;
    const apiError = toApiError(status, error.response?.data);
    if (status === 401 && !error.config?.skipAuth) handleUnauthorized(apiError);
    return Promise.reject(apiError);
  },
);

// 공통 래퍼 { statusCode, result } 만 벗긴다. 작품 목록 · 상세처럼 DTO를 그대로 주는 API에는 쓰지 않는다.
export const unwrap = (response) => response.data?.result;
export const body = (response) => response.data;

export function assetUrl(path) {
  if (!path) return null;
  if (/^(https?:|data:|blob:)/.test(path)) return path;
  return API_BASE_URL + (path.startsWith('/') ? path : `/${path}`);
}
