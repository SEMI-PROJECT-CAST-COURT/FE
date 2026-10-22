import { API_BASE_URL, ApiError, handleUnauthorized, toApiError } from './client';
import { readSse } from './sse';
import { getToken } from '../store/auth';

// 발언 제출 (POST + Authorization 이 필요해서 EventSource 대신 fetch + ReadableStream)
// handlers: { judge, opponent_delta, opponent_judge, stage, turn_done, error }
// 반환: { turnDone: boolean, error?: ApiError } — turn_done 을 받았는지로만 성공을 판단한다(EOF 만으로 확정하지 않음)
export async function submitSpeaking(liveTrialId, content, { signal, handlers }) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/trials/${encodeURIComponent(liveTrialId)}/speakings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({ content }),
      signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new ApiError({ status: 0, businessCode: 'NETWORK_ERROR', message: '서버에 연결하지 못했습니다. 같은 발언을 다시 보내 주세요.' });
  }

  // SSE 를 열기 전 검사 실패는 일반 JSON 오류다(401 · 403 · 404 · 400)
  const type = response.headers.get('content-type') || '';
  if (!response.ok || !type.includes('text/event-stream')) {
    let body = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    const error = toApiError(response.status, body);
    if (response.status === 401) handleUnauthorized(error);
    throw error;
  }

  let turnDone = false;
  let streamError = null;
  await readSse(response.body, ({ event, data }) => {
    let payload = {};
    if (data) {
      try {
        payload = JSON.parse(data);
      } catch {
        payload = {};
      }
    }
    if (event === 'turn_done') turnDone = true;
    if (event === 'error') {
      // 스트림 오류 { status, code, message, retryable, failCount } → 일반 오류와 같은 필드(businessCode)로
      streamError = new ApiError({ status: payload.status, businessCode: payload.code, message: payload.message, retryable: payload.retryable, failCount: payload.failCount });
    }
    handlers?.[event]?.(payload);
  });
  return { turnDone, error: streamError };
}
