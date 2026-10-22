import { ApiError, WS_BASE_URL } from './client';
import { getToken } from '../store/auth';

export const DRAFT_PATHS = {
  case: '/ws/admin/case-draft', // CANDIDATES · REWRITE (+ hello)
  card: '/ws/admin/evidence-card-draft', // CARDS · CARD_SUGGEST
  penalty: '/ws/admin/penalty-draft', // PENALTY
};

const POLICY_VIOLATION = 1008;

// 관리자 AI 초안 WebSocket (브라우저 네이티브 WebSocket · SockJS/STOMP 없음)
// - 연결 후 첫 메시지 { type: "auth", token } (JWT 를 URL 에 넣지 않는다). 성공 응답은 없다.
// - 서버 메시지: delta { text } · done { json } · error { status, code, message }
// - 한 연결에서 AI 작업은 한 번에 하나. 1008 로 닫히면 인증/권한 실패 → 자동 재연결하지 않는다.
export class DraftSocket {
  constructor(path, { hello = false, onStatus } = {}) {
    this.path = path;
    this.hello = hello;
    this.onStatus = onStatus;
    this.ws = null;
    this.pending = null; // { resolve, reject, onDelta }
    this.status = 'idle'; // idle · connecting · open · closed · denied
    this.closedByUser = false;
  }

  setStatus(status, detail) {
    this.status = status;
    this.onStatus?.(status, detail);
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    this.closedByUser = false;
    this.setStatus('connecting');
    const ws = new WebSocket(WS_BASE_URL + this.path);
    this.ws = ws;
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'auth', token: getToken() ?? '' }));
      if (this.hello) {
        // case-draft 만 연결 확인 메시지가 있다 → done { connected: true }
        this.helloPending = true;
        ws.send(JSON.stringify({ type: 'hello' }));
      } else {
        this.setStatus('open');
      }
    };
    ws.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      if (this.helloPending && msg.type === 'done' && msg.json && msg.json.connected) {
        this.helloPending = false;
        this.setStatus('open');
        return;
      }
      const p = this.pending;
      if (!p) return;
      if (msg.type === 'delta') {
        p.onDelta?.(msg.text ?? '');
      } else if (msg.type === 'done') {
        this.pending = null;
        p.resolve(msg.json);
      } else if (msg.type === 'error') {
        this.pending = null;
        p.reject(new ApiError({ status: msg.status, businessCode: msg.code, message: msg.message }));
      }
    };
    ws.onclose = (event) => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.helloPending = false;
      const denied = event.code === POLICY_VIOLATION;
      const error = denied
        ? new ApiError({ status: 401, businessCode: 'WS_AUTHENTICATION_FAILED', message: event.reason || '관리자 인증에 실패했습니다.' })
        : new ApiError({ status: 0, businessCode: 'WS_CLOSED', message: 'AI 초안 연결이 끊겼습니다. 다시 연결해 주세요.' });
      if (this.pending) {
        this.pending.reject(error);
        this.pending = null;
      }
      if (!this.closedByUser) this.setStatus(denied ? 'denied' : 'closed', error);
    };
    ws.onerror = () => {
      // close 이벤트에서 처리
    };
  }

  // 요청 하나를 보내고 done 의 json 을 돌려준다. 실행 중이면 서버가 WS_DRAFT_REQUEST_INVALID 를 보내므로 화면에서 먼저 막는다.
  request(payload, { onDelta } = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || this.status !== 'open') {
      return Promise.reject(new ApiError({ status: 0, businessCode: 'WS_CLOSED', message: 'AI 초안 연결이 준비되지 않았습니다.' }));
    }
    if (this.pending) {
      return Promise.reject(new ApiError({ status: 400, businessCode: 'WS_DRAFT_REQUEST_INVALID', message: '이미 AI 초안을 만드는 중입니다.' }));
    }
    return new Promise((resolve, reject) => {
      this.pending = { resolve, reject, onDelta };
      this.ws.send(JSON.stringify({ type: 'draft', ...payload }));
    });
  }

  // 중단: 응답이 없고 중단된 작업은 done · error 를 보내지 않는다
  cancel() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.pending) {
      this.ws.send(JSON.stringify({ type: 'cancel' }));
    }
    if (this.pending) {
      this.pending.reject(new ApiError({ status: 0, businessCode: 'CANCELLED', message: '중단했습니다.' }));
      this.pending = null;
    }
  }

  close() {
    this.closedByUser = true;
    if (this.pending) {
      this.pending.reject(new ApiError({ status: 0, businessCode: 'CANCELLED', message: '중단했습니다.' }));
      this.pending = null;
    }
    this.ws?.close();
    this.ws = null;
  }
}
