// SSE 텍스트 파서 (Spring SseEmitter 는 "event:이름" / "data:JSON" 을 콜론 뒤 공백 없이 보낸다)
// - 콜론 뒤 공백 1칸은 있어도 없어도 된다
// - 줄 끝은 \n · \r\n · \r 모두 처리 (청크 경계에서 \r 과 \n 이 갈라져도 처리)
// - data 줄이 여러 개면 \n 으로 이어 붙인다
// - 빈 줄에서 이벤트를 내보낸다. 스트림이 끝날 때 남은 이벤트도 내보낸다(end)
export function createSseParser(onEvent) {
  let buffer = '';
  let skipLf = false;
  let eventName = '';
  let dataLines = [];

  const dispatch = () => {
    if (dataLines.length === 0 && !eventName) return;
    const data = dataLines.join('\n');
    const name = eventName || 'message';
    eventName = '';
    dataLines = [];
    onEvent({ event: name, data });
  };

  const line = (text) => {
    if (text === '') {
      dispatch();
      return;
    }
    if (text.startsWith(':')) return; // 주석
    const idx = text.indexOf(':');
    const field = idx === -1 ? text : text.slice(0, idx);
    let value = idx === -1 ? '' : text.slice(idx + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'event') eventName = value;
    else if (field === 'data') dataLines.push(value);
    // id · retry 는 쓰지 않는다
  };

  return {
    push(chunk) {
      let text = chunk;
      if (skipLf && text.startsWith('\n')) text = text.slice(1);
      skipLf = false;
      buffer += text;
      let start = 0;
      for (let i = 0; i < buffer.length; i += 1) {
        const ch = buffer[i];
        if (ch === '\n' || ch === '\r') {
          line(buffer.slice(start, i));
          if (ch === '\r') {
            if (i + 1 < buffer.length) {
              if (buffer[i + 1] === '\n') i += 1;
            } else {
              skipLf = true; // 다음 청크 첫 글자가 \n 이면 같은 줄 끝
            }
          }
          start = i + 1;
        }
      }
      buffer = buffer.slice(start);
    },
    end() {
      if (buffer) {
        line(buffer);
        buffer = '';
      }
      dispatch();
    },
  };
}

// 바이트 스트림 → 텍스트 (UTF-8 글자가 청크 경계에서 갈라져도 안전)
export async function readSse(body, onEvent) {
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8');
  const parser = createSseParser(onEvent);
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parser.push(decoder.decode(value, { stream: true }));
  }
  parser.push(decoder.decode());
  parser.end();
}
