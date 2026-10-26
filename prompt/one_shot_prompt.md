그러면 이제 CAST COURT 프론트엔드를 구현해 줘. 규칙·API·검증 기준은 모두 AGENTS.md를 따른다.
이 요청은 AGENTS.md "3. 구현 순서"의 1~6단계 전체를 순서대로 진행하라는 명시적 지시다.
단계마다 멈춰서 확인을 기다리지 않는다. 다만 각 단계가 끝날 때마다 보고를 남긴다.

## 시작 전 확인
1. 다음을 직접 읽고 AGENTS.md 내용과 다른 점이 있는지 확인한다.
   - ../BE 소스: SecurityConfig, ErrorCode, 각 domain의 controller·dto·service·websocket
   - api-docs.json
   - design/cast-court.tokens.json, src/styles/tokens.css
   - 시안 아티팩트: AGENTS.md의 링크를 Artifact read로 연다
   코드가 AGENTS.md와 다르면 코드를 따르고 그 차이를 1단계 보고에 적는다.
   tokens.css와 tokens.json의 값이 서로 다르면 어느 쪽도 고치지 말고 보고에 적는다.
2. 1단계 보고(API·화면 대응표, 실제 입력 제한, 연결 제한, 만들 파일 목록)를 짧게 출력한 뒤 바로 2단계로 넘어간다.

## 환경
- 현재 FE 폴더에는 AGENTS.md, CLAUDE.md, api-docs.json, design/cast-court.tokens.json, src/styles/tokens.css가 있다. 이 파일들을 지우거나 덮어쓰지 말고 Vite + React(JavaScript) 앱을 이 폴더에 구성한다.
- src/styles/tokens.css는 시안에서 추출한 확정본이다. 수정하지 않고 앱 진입점에서 한 번 import한다. 컴포넌트는 처음부터 이 토큰 변수만 쓴다.
- 백엔드는 http://localhost:8080, 프론트는 http://localhost:5173(strictPort)에서 실행한다. 기준 주소는 .env의 VITE_API_BASE_URL에서 읽는다.
- 실제 서버 검수에는 ../BE/sql 시드 데이터의 계정을 쓴다. 비밀번호를 채팅이나 문서에 다시 적지 않는다.

## 진행 방식
- 단계 순서: 2 공통 기반 → 3 작품·사건 탐색 → 4 재판 전체 흐름 → 5 관리자 전체 흐름 → 6 통합 검수.
- 화면은 시안 아티팩트의 배치·문구·색을 그대로 따른다. 시안에서 확인하지 못한 화면은 임의 디자인으로 완성했다고 보고하지 않는다.
- 판단이 필요한 세부 사항은 AGENTS.md의 기본안대로 진행하고 보고에 기록한다. 백엔드 수정, API 추가, 응답 꾸미기는 하지 않는다.
- 각 단계가 끝날 때마다 npm run lint와 npm run build를 통과시킨다. 서버가 켜져 있으면 브라우저에서 실제 흐름과 시안 일치 여부를 확인하고, 꺼져 있으면 "미확인"으로 분리해 적는다.
- 재판 이탈 정책(이탈하면 그 판은 종료·미저장, 복원하지 않음)과 SSE·WebSocket 처리 규칙은 AGENTS.md 5·6장 그대로 구현한다.
- git 커밋·push·배포는 하지 않는다.

## 최종 보고
다음 순서로 짧게 쓴다.
1. 단계별 완료 여부
2. 실제 서버로 확인한 흐름 / 미확인 항목
3. lint·build 결과
4. AGENTS.md와 코드·시안 사이에서 발견한 차이
5. 남은 일
연결하지 못한 항목이 하나라도 있으면 "전체 완료"라고 쓰지 않는다. 

참고로 기준 클로드 아티팩트는 "CAST COURT 화면 시안"이고,  관련 백엔드 코드는 현재 상위디렉토리의 BE 디렉토리 아래에 있는 코드이다.
