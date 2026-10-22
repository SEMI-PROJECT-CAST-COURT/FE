import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSseParser, readSse } from './sse.js';

const collect = () => {
  const events = [];
  return { events, onEvent: (e) => events.push(e) };
};

test('콜론 뒤 공백 없는 Spring 형식', () => {
  const { events, onEvent } = collect();
  const p = createSseParser(onEvent);
  p.push('event:judge\ndata:{"delta":5}\n\n');
  assert.deepEqual(events, [{ event: 'judge', data: '{"delta":5}' }]);
});

test('콜론 뒤 공백 있는 형식과 CRLF', () => {
  const { events, onEvent } = collect();
  const p = createSseParser(onEvent);
  p.push('event: stage\r\ndata: {"stage":"CARD"}\r\n\r\n');
  assert.deepEqual(events, [{ event: 'stage', data: '{"stage":"CARD"}' }]);
});

test('청크와 이벤트 경계가 다르고 \\r 과 \\n 이 갈라짐', () => {
  const { events, onEvent } = collect();
  const p = createSseParser(onEvent);
  const whole = 'event:opponent_delta\r\ndata:{"text":"가"}\r\n\r\nevent:turn_done\r\ndata:{"nextTurn":"USER"}\r\n\r\n';
  for (const ch of whole) p.push(ch);
  assert.deepEqual(events, [
    { event: 'opponent_delta', data: '{"text":"가"}' },
    { event: 'turn_done', data: '{"nextTurn":"USER"}' },
  ]);
});

test('여러 data 줄은 \\n 으로 이어 붙임', () => {
  const { events, onEvent } = collect();
  const p = createSseParser(onEvent);
  p.push('event:x\ndata:a\ndata:b\n\n');
  assert.equal(events[0].data, 'a\nb');
});

test('끝나지 않은 버퍼는 end 에서 내보냄', () => {
  const { events, onEvent } = collect();
  const p = createSseParser(onEvent);
  p.push('event:turn_done\ndata:{"nextTurn":"VERDICT"}');
  assert.equal(events.length, 0);
  p.end();
  assert.deepEqual(events, [{ event: 'turn_done', data: '{"nextTurn":"VERDICT"}' }]);
});

test('IRON 빈 판정 {} 과 중간 error 이벤트', () => {
  const { events, onEvent } = collect();
  const p = createSseParser(onEvent);
  p.push('event:judge\ndata:{}\n\nevent:error\ndata:{"status":502,"code":"AI_OPPONENT_FAILED","message":"m","retryable":true,"failCount":1}\n\n');
  assert.equal(events.length, 2);
  assert.deepEqual(JSON.parse(events[0].data), {});
  assert.equal(JSON.parse(events[1].data).code, 'AI_OPPONENT_FAILED');
});

test('UTF-8 한글이 바이트 청크 경계에서 갈라져도 복원', async () => {
  const bytes = new TextEncoder().encode('event:opponent_delta\ndata:{"text":"판사님"}\n\n');
  const cut = bytes.indexOf(0xed) + 1; // "판"(ED 8C 90) 첫 바이트 뒤에서 자름
  assert.ok(cut > 1);
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(bytes.slice(0, cut));
      controller.enqueue(bytes.slice(cut, cut + 1));
      controller.enqueue(bytes.slice(cut + 1));
      controller.close();
    },
  });
  const { events, onEvent } = collect();
  await readSse(body, onEvent);
  assert.equal(JSON.parse(events[0].data).text, '판사님');
});

test('turn_done 없이 끊긴 스트림은 turn_done 이벤트가 없음', async () => {
  const bytes = new TextEncoder().encode('event:judge\ndata:{"delta":3}\n\nevent:opponent_delta\ndata:{"text":"중');
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
  const { events, onEvent } = collect();
  await readSse(body, onEvent);
  assert.ok(!events.some((e) => e.event === 'turn_done'));
});
