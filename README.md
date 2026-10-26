# CAST COURT — Frontend

작품 속 인물의 선택을 재판하는 AI 법정 게임의 React 클라이언트.
사용자 · 관리자 · 슈퍼 관리자 화면 전체를 제공하며 PC 화면만 대상으로 한다.

## 기술 스택

| 구분 | 사용 |
|---|---|
| 빌드 | Vite 7 |
| UI | React 19 (JavaScript / JSX), CSS Modules |
| 라우팅 | react-router 7 |
| 서버 상태 | @tanstack/react-query 5 |
| 클라이언트 상태 | zustand 5 (인증 · 테마) |
| HTTP | axios (JSON), fetch + ReadableStream (발언 SSE), 네이티브 WebSocket (관리자 AI 초안) |
| 린트 | ESLint 9 |

TypeScript, UI 컴포넌트 라이브러리, CSS 프레임워크는 쓰지 않는다.

## 실행 방법

### 사전 준비

- Node.js (Vite 7 지원 버전)
- 백엔드 서버가 `http://localhost:8080` 에서 실행 중이어야 한다. (`../BE/README.md` 참고)

### 환경 변수

`.env`

```env
VITE_API_BASE_URL=http://localhost:8080
```

값이 없으면 `http://localhost:8080` 을 쓴다. 포스터 · SSE · WebSocket 주소도 이 값에서 만든다 (`src/api/client.js`).

### 명령어

```bash
npm install
npm run dev       # 개발 서버 http://localhost:5173
npm run build     # dist/ 로 빌드
npm run preview   # 빌드 결과 미리보기
npm run lint      # ESLint
npm test          # node --test (src/**/*.test.js)
```

> 백엔드 CORS · WebSocket 허용 출처가 `http://localhost:5173` (및 `http://192.168.*:5173`) 뿐이라 `strictPort: true` 로 포트를 고정한다. 5173 이 사용 중이면 다른 포트로 바뀌지 않고 실행이 실패한다.
> 같은 와이파이의 다른 PC 에서 접속하려면 `npm run dev -- --host` 로 실행한다.

## 프로젝트 구조

```
FE/
├── AGENTS.md                    구현 지침 (화면 규칙 · 서버 통신 규칙)
├── CLAUDE.md                    AGENTS.md 진입 파일
├── api-docs.json                백엔드 Swagger 스냅샷 (참고용, WebSocket 미포함)
├── design/cast-court.tokens.json  디자인 토큰 원본
├── index.html                   첫 렌더 전 테마 · 고대비 적용, 글꼴 로드
└── src/
    ├── main.jsx                 앱 진입점
    ├── router.jsx               라우트 정의
    ├── queryClient.js           react-query 설정
    ├── api/                     서버 요청 · 응답 변환
    │   ├── client.js            axios 인스턴스, 기준 주소, ApiError, 401 처리
    │   ├── auth.js · categories.js · works.js · cases.js · trials.js
    │   ├── speaking.js          발언 제출 (POST SSE)
    │   ├── sse.js               SSE 파서
    │   └── draftSocket.js       관리자 AI 초안 WebSocket
    ├── components/              공통 UI · 재판 UI (Button, Field, Gauge, EvidenceCard, SpeakingBubble, Guards …)
    ├── pages/                   URL 에 대응하는 화면
    │   ├── trial/               재판 진행 화면과 상태 관리
    │   └── admin/               관리자 · 슈퍼 관리자 화면
    ├── store/
    │   ├── auth.js              로그인 정보 (sessionStorage)
    │   ├── theme.js             테마 · 고대비 (localStorage)
    │   └── trialHandoff.js      준비 → 재판 화면 시작 응답 전달 (메모리)
    ├── lib/                     재판 표시 규칙 · 텍스트 유틸
    └── styles/
        ├── tokens.css           디자인 토큰 CSS (직접 수정하지 않음)
        └── global.css
```

## 화면 · 라우트

| 경로 | 화면 | 권한 |
|---|---|---|
| `/login` | 로그인 · 회원가입 | 공개 |
| `/logout` | 로그아웃 | - |
| `/rules`, `/credits` | 재판 규칙, 크레딧 | 공개 |
| `/works` | 작품 목록 (검색 · 카테고리 · 정렬 · 페이지), 관리자는 카테고리 관리 | 로그인 |
| `/works/:workId` | 작품 상세 · 사건 목록 · 진행도 | 로그인 |
| `/works/:workId/cases/:caseId/setup` | 재판 준비 (역할 · 모드 선택) | 로그인 |
| `/works/:workId/cases/:caseId/trial` | 재판 진행 | 로그인 |
| `/works/:workId/cases/:caseId/records` | 사건별 역할 기록 | 로그인 |
| `/records/:recordId` | 재판 기록 상세 | 로그인 |
| `/me/records` | 내 기록 · 통계 | 로그인 |
| `/admin/works/new`, `/admin/works/:workId/edit` | 작품 등록 · 수정 (AI 소개 초안) | ADMIN |
| `/admin/works/:workId/cases/new`, `.../cases/:caseId/edit` | 사건 등록 · 수정 (AI 초안) | ADMIN |
| `/admin/accounts` | 관리자 계정 관리 | SUPER_ADMIN |

`/` 는 `/works` 로 이동한다. 권한 검사는 `components/Guards.jsx` 의 `RequireAuth` · `RequireAdmin` · `RequireSuper` 가 맡으며, 최종 권한 판단은 서버가 한다.

## 주요 동작

### 인증

- 로그인 결과(`token`, `nickname`, `authority`)는 sessionStorage 에 저장하고 모든 요청에 `Authorization: Bearer <token>` 을 붙인다.
- 토큰 수명은 1시간이며 갱신 API 가 없어 만료되면 다시 로그인한다.
- 인증된 요청이 401 이면 로그인 정보를 지우고 로그인 화면으로 보낸다.

### 재판 진행 (SSE)

- 발언은 `POST /api/trials/{trialId}/speakings` 로 보내고 `text/event-stream` 응답을 fetch 로 읽는다.
- 이벤트: `judge` → `opponent_delta`(여러 번) → `opponent_judge` → `stage`(단계 · 카드가 바뀔 때) → `turn_done`, 실패 시 `error`
- `turn_done` 을 받아야 그 턴이 확정된다. 실패하거나 끊기면 화면을 마지막 확정 상태로 되돌리고 입력한 발언은 보존한다.
- 모드(`CHICKEN` / `CHALLENGER` / `IRON`)에 따라 서버가 게이지 · 판정 · 카드 공개 범위를 정하며, 화면은 받은 값만 표시한다.

### 재판 이탈 정책

판결 전에 재판 화면을 벗어나면(나가기, 다른 화면 이동, 뒤로 가기, 새로고침, 탭 닫기) 그 판은 끝난 것으로 보고 기록되지 않는다.
진행 상태는 메모리에만 두고, 이탈 시 `DELETE /api/trials/{trialId}` 를 보낸다 (새로고침 · 탭 닫기는 `keepalive` fetch 로 최선 노력).

### 관리자 AI 초안 (WebSocket)

| 경로 | 용도 |
|---|---|
| `/ws/admin/case-draft` | 사건 후보(`CANDIDATES`) · 재작성(`REWRITE`) |
| `/ws/admin/evidence-card-draft` | 근거 카드(`CARDS`) · 카드 수정 제안(`CARD_SUGGEST`) |
| `/ws/admin/penalty-draft` | 형벌 단계(`PENALTY`) |

연결 후 첫 메시지로 `{ type: "auth", token }` 을 보낸다. 1008 로 닫히면 인증 · 권한 실패이므로 자동 재연결하지 않는다.
AI 결과는 편집 초안이며 저장은 사건 등록 · 수정 API 로 따로 한다.

## 디자인 · 테마

- 디자인 값은 `src/styles/tokens.css` 의 CSS 변수로만 쓴다. 컴포넌트 CSS 에 HEX 색을 직접 넣지 않는다.
- 테마는 다크(기본) · 라이트 × 일반 · 고대비 4가지이며 `html[data-theme]`, `html[data-contrast]` 속성으로 전환한다.
- 선택값은 localStorage `cc-theme`(`system | light | dark`), `cc-contrast`(`high | normal`) 에 저장한다.
- 글꼴: IBM Plex Sans KR (Google Fonts)

## 개발 참고

- 상세한 화면 규칙 · API 대응표 · 응답 형식 · 검증 규칙은 [`AGENTS.md`](./AGENTS.md) 를 기준으로 한다.
- API 동작이 `api-docs.json` 과 다르면 백엔드(`../BE`) 실제 코드를 따른다.
- 커밋 메시지는 `타입: 한글 설명` (feat, fix 등), 기능별 `feature/*` 브랜치 → `develop` 으로 병합한다.
