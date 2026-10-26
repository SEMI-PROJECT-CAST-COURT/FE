import { useCallback, useEffect, useRef, useState } from 'react';
import { DraftSocket } from '../../api/draftSocket';

// 화면이 열려 있는 동안만 연결하고, 떠나면 닫는다(서버가 실행 중인 작업을 멈춤).
export function useDraftSocket(path, { hello = false } = {}) {
  const socketRef = useRef(null);
  const [status, setStatus] = useState('connecting');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null); // 실행 중인 작업 이름

  useEffect(() => {
    const socket = new DraftSocket(path, {
      hello,
      onStatus: (s, detail) => {
        setStatus(s);
        setError(detail ?? null);
      },
    });
    socketRef.current = socket;
    socket.connect();
    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [path, hello]);

  const run = useCallback(async (label, payload) => {
    const socket = socketRef.current;
    if (!socket) throw new Error('연결 없음');
    setBusy(label);
    try {
      return await socket.request(payload);
    } finally {
      setBusy(null);
    }
  }, []);

  const cancel = useCallback(() => socketRef.current?.cancel(), []);
  const reconnect = useCallback(() => socketRef.current?.connect(), []);

  return { status, error, busy, run, cancel, reconnect };
}
