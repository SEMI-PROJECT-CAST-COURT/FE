# CAST COURT — 프론트엔드 에이전트 지침

작품 속 인물의 선택을 재판하는 AI 법정 게임의 React 클라이언트.
사용자·관리자·슈퍼 관리자 화면 전체를 구현하되 PC 화면만 대상으로 함.

이 문서는 구현 지침이며 프론트엔드 구현 완료 보고서가 아니다.
1층은 화면 규칙, 2층은 서버 통신 규칙이다.

## 기준과 작업 범위

- 확정 사항: **실제 백엔드 코드 우선**, CAST COURT 화면 시안 아티팩트 그대로 구현, 전체 기능 범위, 모바일 제외.
- 동작·경로·필드·검증·공개 범위는 Controller → DTO → Service → SecurityConfig 순으로 확인한다. 주석·Swagger 설명과 실행 코드가 다르면 실행 코드가 우선이다.
- 화면 배치·문구·색상은 CAST COURT 화면 시안 아티팩트를 따른다. 동작이 실제 코드와 다르면 동작은 코드에 맞추고 구현 전에 차이를 보고한다.
- FE와 BE는 같은 상위 폴더 아래에 둔다. 상위 폴더의 이름과 개인 PC의 저장 위치는 고정하지 않는다.
- 프론트 루트는 이 `AGENTS.md`가 있는 FE 폴더이며, 백엔드 원본은 `../BE`, Swagger 스냅샷은 `api-docs.json`이다.
- 이 문서의 상대 경로는 FE 루트 기준이다. 백엔드 소스 경로는 `../BE/src/main/java/com/verdict/castcourt/` 아래를 기준으로 한다.
- 개인 PC의 절대 경로를 공용 지침에 기록하지 않는다.
- 백엔드·DB·기존 문서의 임의 수정, 기능 축소, 기획에 없는 확장, 배포는 범위에 포함하지 않는다.
- 시작 전에 현재 코드의 API 대응표·변경 파일·화면 순서·연결 제한을 짧게 보고한다. 명시적으로 구현을 요청받았다면 이 보고 후 허용된 현재 단계 작업을 진행한다.
- 없는 API나 식별자를 임의로 만들거나 성공 응답을 꾸미지 않는다. 해당 기능만 연결 미완료로 보고하고 독립적인 작업은 계속한다.

### 구현 시 확인할 자료

| 자료 | 위치 |
|---|---|
| 기능·API·검증·권한 | `../BE`의 실제 코드 |
| HTTP API 목록(참고) | `api-docs.json` — WebSocket은 포함되지 않음, 상태 코드 표기가 실제와 다른 곳 있음 |
| 화면 구성·배치·문구·디자인 | [CAST COURT 화면 시안](https://claude.ai/artifact/GrbUbvKUBZJaTmB1FfCJfY) |
| 디자인 값 | `design/cast-court.tokens.json`(기준), `src/styles/tokens.css`(앱에서 쓰는 CSS) |

- 같은 프로젝트의 갱신된 시안 아티팩트를 받으면 그 버전을 따른다. 접근하지 못한 화면을 확인했다고 주장하지 않는다.
- 별도 로컬 명세서나 화면 이미지 복사본은 필수 자료가 아니다. 기능은 백엔드 코드, 화면은 아티팩트를 직접 확인한다.
- 아래 API·검증 내용은 **2026-10-22 BE `develop` 브랜치(관리자 목록 id·authority 추가, SUPER_ADMIN 비활성화 차단 PR #37·#38, 근거 카드 내용 100자 PR #40, 포스터 500KB PR #41 반영) 소스 확인 시점**의 스냅샷이다. 구현 시작 때 다시 읽어 갱신한다.

# 1층. 화면 규칙

## 1. 기술과 책임

이미 설치된 프로젝트가 생겼다면 기존 구성을 먼저 확인한다.

- Vite + React + JavaScript/JSX, CSS Modules.
- 앱 라이브러리 기본안: `react`, `react-dom`, `react-router`, `axios`, `zustand`, `@tanstack/react-query`.
- TypeScript, UI 컴포넌트 라이브러리, CSS 프레임워크는 넣지 않는다. 서버 데이터 캐시는 react-query 하나로 처리하고, zustand는 인증·테마처럼 클라이언트가 소유한 상태에만 쓴다.
- 위 선택은 원본 프로젝트에 이미 설치돼 있다는 뜻이 아니다. 구현할 때 버전과 호환성을 확인하고 초기 설정에 기록한다.
- JSON 요청은 axios, 발언 SSE는 fetch + ReadableStream, 관리자 AI 초안은 브라우저 네이티브 WebSocket을 쓴다.
- 서버 요청 함수와 응답 변환은 api에 둔다. 페이지가 주소·인증 헤더·응답 래퍼를 직접 조립하지 않는다.
- 서버가 계산하는 게이지·점수·난이도·형벌 단계·판정·플레이 가능 여부는 응답을 따른다. 클라이언트는 표시만 담당한다.
- 결과 이름(완승~완패)은 서버가 보내지 않는다. 역할과 penaltyTier로 화면에서 매핑한다(5장 참고).

```text
FE/
    AGENTS.md
    CLAUDE.md                      AGENTS.md를 불러오는 진입 파일(@AGENTS.md)
    api-docs.json                  Swagger 스냅샷(참고용)
    design/cast-court.tokens.json  시안에서 추출한 토큰 원본
    src/
        styles/tokens.css          시안에서 추출한 토큰 CSS (직접 고치지 않음, 2장 "토큰 사용" 참고)
        api/                       client, auth, categories, works, cases, trials, speaking(SSE), draftSocket(WS)
        components/                공통 UI·재판 UI
        pages/                     URL에 대응하는 화면
            admin/                 관리자·슈퍼 관리자 화면
        store/                     인증·테마처럼 공유하는 상태
```

폴더는 필요한 시점에 만든다. 빈 파일·역할 없는 계층·범용 서비스 프레임워크를 먼저 만들지 않는다.
화면 내부 값은 useState, 검색·정렬·카테고리·페이지·기록 필터는 URL 쿼리로 관리한다.
서버 목록 전체를 전역 스토어에 중복 저장하지 않는다. 진행 중 발언과 입력은 해당 재판 화면이 소유한다.

## 2. 화면 범위와 디자인

| 영역 | 구현 범위 |
|---|---|
| 공통 | 저울 로고·헤더·푸터·테마·고대비·권한별 메뉴·로딩·빈 목록·오류 |
| 인증 | 로그인·일반 사용자 회원가입·로그아웃 |
| 작품 | 목록·검색·카테고리 필터·정렬·페이지 이동·상세·사건 목록·진행도 |
| 재판 | 준비·역할·모드 선택·진행·판결·역할별 기록·내 기록·통계 |
| 안내 | 재판 규칙·크레딧 |
| 관리자 | 카테고리 관리·작품 등록/수정/삭제·작품 소개 AI 초안·사건 등록/수정/삭제·AI 후보/재작성/카드/카드 수정 제안/형벌 초안 |
| 슈퍼 관리자 | 관리자 목록·관리자 계정 생성·계정 비활성화 |

- 시안 아티팩트의 구성·정렬·밀도·색상·버튼 위치를 그대로 따른다. 새로운 랜딩 화면이나 다른 디자인으로 재해석하지 않는다.
- PC 화면에서 레이아웃과 스크롤을 검수한다. 모바일·태블릿 전용 화면은 만들지 않는다. 시안은 미디어쿼리 없이 flex-wrap과 `repeat(auto-fit, minmax(var(--grid-card-min), 1fr))` 그리드로 폭에 대응한다.
- 시안 미확인 영역을 임의 디자인으로 완성했다고 보고하지 않는다. 해당 화면의 아티팩트를 먼저 확인한다.
- 작품 포스터는 응답의 posterUrl을 서버 주소 기준으로 표시한다. 로드 실패 시 공통 이미지 자리(`--surface-4`)를 표시한다.
- 검사 아이콘은 돋보기, 변호인은 방패, 판사는 판사봉, 브랜드는 저울이다. 이모지를 UI 아이콘 대용으로 쓰지 않는다.
- 아이콘은 viewBox 24, stroke 1.8, 둥근 끝·접합, `stroke=currentColor`, fill none. 크기는 `--icon-sm`(14, 버튼·배지 안) · `--icon-md`(16, 헤더 메뉴) · `--icon-lg`(20, 카드 제목) · `--icon-logo-header`(26).
- 동일한 Logo, Icon, Button, Field, Tabs, RoleBadge, Gauge, SpeakingBubble, EvidenceCard를 재사용한다.
- 화면 문구는 시안을 우선하고 기획 문구는 명사형을 유지한다. 서버 오류 메시지는 의미를 바꾸지 않는다.
- 로딩·비활성·빈 결과·입력 오류·실패 후 재시도·삭제 확인·권한 부족을 각 기능에 포함한다.
- 입력에 label, 아이콘 버튼에 접근 가능한 이름, 키보드 포커스를 둔다. 모달은 포커스 이동·복귀를 처리한다.
- 색상만으로 역할·성공·실패를 구분하지 않는다(아이콘·글자 병기). 스트리밍 발언을 매 조각마다 스크린리더에 읽히게 하지 않는다.

### 토큰 사용

토큰 원본은 시안 아티팩트에서 추출한 `cast-court.tokens.json` / `cast-court.tokens.css` 두 파일이다.

- JSON은 `design/cast-court.tokens.json`, CSS는 `src/styles/tokens.css`로 그대로 복사해 앱 진입점에서 한 번 import한다. 생성 스크립트는 만들지 않는다. 두 파일 값이 다르면 수정하지 말고 보고한다.
- 색은 `var(--bg)`, `var(--text)`, `var(--def)`처럼 토큰으로만 쓴다. 컴포넌트에 HEX를 직접 넣지 않는다. 예외는 `--primary`(#2f6fe0)와 `--on-primary`(#ffffff)뿐이며 이것도 변수로 참조한다.
- 글자 크기 `--fs-*`, 굵기 `--fw-*`, 줄 높이 `--lh-*`, 간격 `--space-*`, 모서리 `--radius-*`, 컨트롤 높이 `--h-*`를 쓴다. 토큰에 없는 값이 시안에 있으면 가장 가까운 단계로 맞추고 차이를 보고한다.
- 자주 쓰는 기준: 본문·입력·버튼 `--fs-md`(14) · 라벨·배지 `--fs-xs`(12) · 기본 버튼·입력 높이 `--h-default`(42) · 버튼·입력 모서리 `--radius-lg`(10) · 카드 `--radius-xl`(12) · 팝업 `--radius-3xl`(16).
- 레이아웃 폭: 헤더·푸터·목록 `--container`(1200px), 기록·규칙 960~980px, 재판 준비·상세 820~920px, 긴 문단 680px, 로그인·회원가입 400~440px. 헤더 `--header-h`(65), 푸터 `--footer-h`(64).
- 글꼴은 `--font-sans`(IBM Plex Sans KR). Google Fonts에서 wght 400;500;600;700;800을 index.html의 link로 불러온다. `--font-mono`는 토큰명·API·DB 명세 표시에만 쓴다.
- 그림자는 쓰지 않는다. 깊이는 surface 단계(`--bg` → `--surface` → `--surface-2~4`)와 테두리로 표현한다.
- 비활성은 `opacity: var(--opacity-disabled)`(0.45). 점선 영역은 `--line-4` dashed. 선택된 카드는 2px 테두리.
- 역할 색: 변호인·무죄 쪽 `--def` 계열, 검사·유죄 쪽 `--pro` 계열, 관리자 `--admin` 계열, 성공 `--win` 계열, 위험 `--danger` 계열. 위험 버튼은 `--danger-btn` 바탕에 `--on-primary` 글자.
- 게이지는 `--gauge-track` 트랙, 결과 화면 `--gauge-fill` 채움, 바늘 이동 `left var(--dur-gauge) var(--ease-gauge)`. 진행 중 트랙 높이 14px(`--radius-gauge`), 결과·목록 12px(`--radius-2xs`). 게이지는 조작 컨트롤이 아니라 서버 상태 표시이다.
- `accent-alternatives`의 보라·주황은 시안 후보일 뿐이다. 주 액션은 모든 테마에서 `--primary`로 고정한다.

### 테마·고대비

- CSS 구조: `:root`가 다크(기본), `html[data-theme="light"]`가 라이트, `html[data-contrast="high"]`가 고대비이며 두 속성을 조합해 4모드(dark, light, dark-hc, light-hc)를 만든다.
- 사용자 선택값은 localStorage `cc-theme`(`system | light | dark`)과 `cc-contrast`(`high | normal`)에 저장한다. 기본값은 system이다.
- tokens.css에는 `prefers-color-scheme` 미디어 쿼리가 없다. system이면 `matchMedia('(prefers-color-scheme: light)')` 결과로 `data-theme`을 light/dark로 직접 설정하고, OS 변경 이벤트를 반영한다.
- 첫 화면 깜빡임을 막도록 index.html의 head에서 렌더 전에 속성을 적용한다. 테마는 계정/DB에 저장하지 않는다.

## 3. 구현 순서와 완료 조건

이 목차는 **향후 프론트 구현 순서**이다.

1. **코드·시안 대조** — API/화면 대응표·실제 입력 제한·현재 연결 상태를 보고하면 완료.
2. **공통 기반** — 앱 실행·라우팅·토큰 적용·공통 UI·인증·테마가 동작하면 완료.
3. **작품·사건 탐색** — 실제 목록/상세/검색/필터/페이지/사건 목록/준비 화면이 연결되면 완료.
4. **재판 전체 흐름** — 역할·모드별 진행/SSE/판결/기록/통계와 실패 복구가 연결되면 완료.
5. **관리자 전체 흐름** — 카테고리/작품/사건 등록·수정·삭제/AI 초안 3경로/관리자 계정 화면이 연결되면 완료. API가 없는 항목은 완료 처리하지 않음.
6. **통합 검수** — 실제 서버·브라우저에서 전체 흐름, 4모드 테마, 새로고침·재판 이탈, 오류, 권한을 확인하고 결과를 기록하면 완료.

지정 단계만 진행한다. `계속`은 현재 단계의 남은 작업만 뜻한다.
목차 번호·순서·확정 기준을 임의로 바꾸지 않는다. 현재 단계의 추가 일은 4-A처럼 하위 항목으로 넣는다.
진행 보고는 전체 목표 → 확정 내용 → 현재 단계 → 이번 범위 → 남은 단계 순서로 짧게 쓴다.
관련 없는 리팩터링·최적화·새 기능은 추가 검토 사항에만 기록한다.

# 2층. 서버 통신 규칙

## 4. 서버·인증·응답

### 기준 위치

`../BE/src/main/java/com/verdict/castcourt/` 아래를 확인한다.

| 확인 대상 | 소스 |
|---|---|
| 권한·공개 경로 | global/security/SecurityConfig.java |
| HTTP 허용 출처 | global/config/CorsConfig.java |
| WS 출처·인증·메시지 | global/websocket/WebSocketConfig.java, BaseWebSocketHandler.java, 각 domain의 websocket/*Handler.java |
| 응답 래퍼 | global/response/SingleResponse.java, ListResponse.java, ErrorResponse.java |
| 오류 코드·HTTP 상태 | global/exception/ErrorCode.java, handler/GlobalExceptionHandler.java |
| 재판 공개 범위 | domain/trial/rule/VisibilityRule.java |
| 점수·형벌 단계·승패 | domain/trial/rule/ScoreRule.java |
| 발언 순서·3번째 카드 | domain/trial/session/TrialTurnOrder.java |
| SSE 흐름 | domain/speaking/service/SpeakingService.java, speaking/dto/response/* |
| 포스터 업로드 상한 | domain/work/controller/PosterWebConfig.java, work/service/PosterStorage.java |
| 기능 계약 | 각 domain의 controller, dto, service |

- 개발 서버는 `http://localhost:8080`(application.yaml `server.port`), FE는 `http://localhost:5173`이다.
- CORS(HTTP)와 WebSocket 핸드셰이크 모두 `http://localhost:5173`만 허용한다. Vite에 `strictPort: true`를 두며 점유 시 다른 포트로 바꾸지 않는다.
- 서버 주소는 환경설정(`VITE_API_BASE_URL`)에서 읽어 api/client 한 곳에서 관리한다. 포스터·SSE·WS(`ws://` 변환) 주소도 이 기준에서 파생한다.
- **모든 경로가 /api로 시작하는 것이 아니다.** 계정은 `/login`, `/signup/user`, `/signup/admin`, `/account/admin`, `/admin/{id}`이고, 이미지는 `/uploads/posters/**`, `/images/default-poster.svg`이다.
- `api-docs.json`은 springdoc이 만든 참고용 스냅샷이다. 2026-10-21 갱신본(관리자 목록 AccountDTO의 id·authority 반영)이지만, 일부 응답 코드(201·204)를 200으로 표기하고 사건 목록의 my를 "null로 응답"이라고 적는 등 코드와 다른 곳이 남아 있다. 다르면 코드를 따른다.
- 로그에 JWT·비밀번호·사용자 발언 원문을 남기지 않는다.

### 인증

- 로그인 요청은 `{ username, password }`, 결과는 `{ statusCode: 200, result: { token, nickname, authority } }`이다.
- 권한 값은 `USER` / `ADMIN` / `SUPER_ADMIN`이다. ROLE_ 접두사를 붙이거나 다른 이름으로 바꾸지 않는다.
- 로그인 결과(token, nickname, authority)를 인증 스토어에 저장하고 공통 요청 계층에서 `Authorization: Bearer <token>`을 붙인다.
- 인증 보존은 sessionStorage를 기본안으로 둔다. 새로고침 시 복구하고 로그아웃·만료 시 지운다. 토큰 수명은 1시간(`jwt.access-token-expiration` 3600000ms)이며 갱신 API는 없다. 장기 로그인·토큰 갱신을 임의 추가하지 않는다.
- 로그인 실패: 빈 값 400 `LOGIN_REQUEST_INVALID`, 아이디/비밀번호 불일치·비활성 계정 401 `INVALID_CREDENTIALS`. 로그인 화면의 401은 폼 오류로 표시한다.
- 인증된 요청의 401(`AUTHENTICATION_REQUIRED`, `AUTH_TOKEN_EXPIRED`, `AUTH_TOKEN_INVALID`)은 인증 상태를 비우고 로그인으로 이동한다. 403 `ACCESS_DENIED`는 권한 오류로 표시한다.
- 공개 요청(토큰 불필요): `POST /login`, `POST /signup/user`, `GET /api/categories`, `GET /uploads/**`, `GET /images/default-poster.svg`, `/ws/**` 핸드셰이크(인증은 첫 메시지로 함).
- 그 외 모든 요청은 인증 필요. `/api/admin/categories|works|cases/**`는 ADMIN·SUPER_ADMIN, `POST /signup/admin`·`GET /account/admin`·`DELETE /admin/{id}`는 SUPER_ADMIN만 허용한다.
- 메뉴 노출: 관리자 메뉴는 ADMIN/SUPER_ADMIN, 계정 관리는 SUPER_ADMIN만. UI 숨김은 편의 처리이고 최종 권한은 서버가 판단한다. userId를 임의로 보내거나 테스트용 헤더를 붙이지 않는다.
- 로그아웃은 클라이언트 인증 제거로 처리한다. 로그아웃 API는 없다.
- 계정을 비활성화해도 이미 발급된 토큰은 만료 전까지 유효하다(서버가 토큰 사용 시 계정 상태를 확인하지 않음). 화면에서 즉시 차단된다고 표시하지 않는다.

### 응답 변환

응답 형식은 API마다 다르다. 모든 응답을 무조건 result로 벗기지 않는다.

| 종류 | 실제 형태 | 해당 API |
|---|---|---|
| 공통 성공 | `{ statusCode, result }` | 계정, 카테고리 목록, 사건, 재판·기록 |
| 작품 목록 | `{ content, totalElements, totalPages, page, size }` 직접 | GET /api/works |
| 직접 DTO | 응답 DTO 그대로 | 작품 상세, 작품 등록 `{ workId }`, 소개 초안 `{ summary }`, 카테고리 생성 `{ categoryId }` |
| 본문 없는 성공 | 200 또는 204, 빈 본문 | 카테고리 이름 수정·순서 변경(200)·삭제(204), 작품 수정(200)·삭제(204), 사건 수정(200)·삭제(204), 재판 나가기(204) |
| 일반 오류 | `{ statusCode, businessCode, message }` | 모든 HTTP 오류 (SSE 열기 전 포함) |
| SSE 오류 이벤트 | `{ status, code, message, retryable, failCount }` | 발언 스트림 중 실패 |
| WS 오류 메시지 | `{ type: "error", status, code, message }` | 관리자 AI 초안 |

- HTTP 상태와 본문의 statusCode가 다를 수 있다. 사건 등록은 HTTP 200에 본문 `statusCode: 201`, 재판 시작은 HTTP 201에 본문 `statusCode: 201`이다. 성공 판정은 HTTP 상태(2xx)로 한다.
- 일반 Error는 message·status·businessCode를 유지한다. 스트림의 code는 같은 내부 필드(businessCode)로 매핑한다.
- 프레임워크 수준 오류(JSON 파싱 실패, 타입 불일치, 405 등)는 businessCode가 `BAD_REQUEST`·`METHOD_NOT_ALLOWED`처럼 HTTP 상태 이름일 수 있다.
- 204·빈 본문에 JSON을 강제 파싱하지 않는다. 실패 시 무조건 재요청하지 않으며 POST 중복 제출을 막는다.
- posterUrl은 `/uploads/posters/<uuid>.jpg|png` 또는 `/images/default-poster.svg` 같은 서버 상대 경로다. 기준 주소를 붙여 표시한다. data·blob 미리보기는 업로드 전 임시 표현이며 저장 성공과 구분한다.

### 현재 HTTP API 대응표

| 영역 | 요청 | 용도 | 성공 응답 |
|---|---|---|---|
| 계정 | POST /login | 로그인 | 200 Single |
| 계정 | POST /signup/user | 일반 회원가입 | 200 Single(문자열) |
| 계정 | POST /signup/admin | 관리자 생성 (SUPER_ADMIN) | 200 Single(문자열) |
| 계정 | GET /account/admin | 관리자 목록 (SUPER_ADMIN) | 200 List |
| 계정 | DELETE /admin/{id} | 관리자 비활성화 (SUPER_ADMIN) | 200 Single(문자열) |
| 카테고리 | GET /api/categories | 목록 (공개) | 200 List |
| 카테고리 | POST /api/admin/categories | 추가 | 201 `{ categoryId }` |
| 카테고리 | PATCH /api/admin/categories/{categoryId} | 이름 수정 | 200 빈 본문 |
| 카테고리 | PUT /api/admin/categories/order | 순서 변경 | 200 빈 본문 |
| 카테고리 | DELETE /api/admin/categories/{categoryId} | 삭제 | 204 |
| 작품 | GET /api/works | 검색·필터·정렬·목록 | 200 페이지 직접 |
| 작품 | GET /api/works/{workId} | 상세 | 200 직접 |
| 작품 | POST /api/admin/works | 등록 (multipart) | 201 `{ workId }` |
| 작품 | PUT /api/admin/works/{workId} | 수정 (multipart) | 200 빈 본문 |
| 작품 | DELETE /api/admin/works/{workId} | 삭제 | 204 |
| 작품 | POST /api/admin/works/summary-draft | 소개 AI 초안 | 200 `{ summary }` |
| 사건 | GET /api/works/{workId}/cases | 작품별 사건 목록·진행도·내 판결 | 200 Single |
| 사건 | GET /api/cases/{caseId}/setup | 재판 준비 | 200 Single |
| 사건 | GET /api/admin/cases/{caseId} | 관리자 상세(수정 화면) | 200 Single |
| 사건 | POST /api/admin/cases | 사건·카드·형벌표 등록 | 200 Single(caseId) |
| 사건 | PUT /api/admin/cases/{caseId} | 사건·카드·형벌표 수정 | 200 빈 본문 |
| 사건 | DELETE /api/admin/cases/{caseId} | 사건 삭제 | 204 |
| 재판 | POST /api/trials | 시작 | 201 Single |
| 재판 | GET /api/trials/{trialId} | 진행 상태(같은 화면 안 확인용) | 200 Single |
| 재판 | POST /api/trials/{trialId}/speakings | 발언 (POST SSE) | 200 text/event-stream |
| 재판 | POST /api/trials/{trialId}/verdict | 판결·DB 저장 | 200 Single |
| 재판 | DELETE /api/trials/{trialId} | 나가기 | 204 |
| 기록 | GET /api/trials/{trialId}/record | 저장된 기록 (DB id) | 200 Single |
| 기록 | GET /api/cases/{caseId}/records | 역할별 기록 요약 | 200 Single |
| 기록 | GET /api/users/me/trials | 내 기록·커서 페이지 | 200 Single |
| 기록 | GET /api/users/me/stats | 내 통계 | 200 Single |

관리자용 사건 목록 API는 따로 없다. 관리자 사건 목록도 `GET /api/works/{workId}/cases`를 쓴다.

## 5. 화면별 데이터와 검증

문자열 길이는 서비스 구현과 같은 방식으로 센다. **codePointCount**(이모지 1자): 작품 title/author/summary, 카테고리 이름, 소개 초안 입력. **Java length**(UTF-16, 이모지 2자): 사건·카드·형벌표·발언·AI 초안 요청. 입력 카운터와 클라이언트 검증도 이 기준에 맞춘다.

### 계정

- 가입·관리자 생성 본문 `{ username, password, nickname }`. authority는 서버가 경로에 따라 정한다(USER / ADMIN).
- 서버 검증은 세 값 필수(공백만 불가)와 아이디 중복(409 `USERNAME_ALREADY_EXISTS`)뿐이다. username·nickname은 trim 후 저장, password는 trim하지 않는다. 길이·형식 제한은 백엔드에 없으므로 시안에 있는 제한을 백엔드 확정 규칙이라고 주장하지 않는다.
- 관리자 목록 항목은 `{ id, username, nickname, authority, usage }`이며 USER가 아닌 계정(ADMIN·SUPER_ADMIN)이 id 순으로 온다. usage=false는 비활성 계정이다. authority로 ADMIN·SUPER_ADMIN 배지를 구분한다.
- 비활성화는 목록의 `id`로 `DELETE /admin/{id}`를 보낸다. 성공은 `{ statusCode: 200, result: "계정 비활성화 성공" }`, 없는 id는 404 `ADMIN_NOT_FOUND`, SUPER_ADMIN 계정은 400 `SUPER_ADMIN_DELETE_FORBIDDEN`. 확인 모달 후 요청하고 성공하면 목록을 재조회한다. 행 번호나 username을 id 대신 쓰지 않는다.
- 화면 처리:
  - authority=SUPER_ADMIN 행(본인 포함)은 비활성화 버튼을 표시하지 않는다. 서버도 막지만 요청 전에 막는다.
  - usage=false 행은 버튼을 비활성으로 표시한다. 서버는 이미 비활성인 계정에도 200을 돌려주며, 다시 활성화하는 API는 없다.

### 카테고리

- 목록 항목 `{ categoryId, name, sortOrder, fixed }`. 일반 카테고리가 sortOrder 순으로 오고 fixed=true인 "미분류"가 맨 뒤에 온다.
- 추가 `{ name }`, 이름 수정 `{ name }`. strip 후 1~10자(codePoint). 빈 이름 400, 10자 초과 400 `CATEGORY_NAME_TOO_LONG`, 중복 **400** `CATEGORY_NAME_DUPLICATE`.
- 미분류는 이름 수정(400 `FIXED_CATEGORY_IMMUTABLE`)·삭제(400 `FIXED_CATEGORY_DELETE_FORBIDDEN`) 불가.
- 순서 변경 `{ categoryIds }`: 미분류를 뺀 **나머지 전체** ID를 중복 없이 보낸다. 하나라도 빠지거나 더해지면 400 `INVALID_CATEGORY_ORDER`. 서버가 미분류를 맨 뒤로 고정한다.
- 삭제는 실제 행 삭제이며, 그 카테고리의 작품은 모두 미분류로 옮겨진다. 삭제 확인 문구에 이 이동을 알리고 성공 후 카테고리·작품 목록을 재조회한다.

### 작품

- 목록 쿼리: `categoryId`(1 이상), `keyword`(strip 후 **제목에 포함**되는지 검사), `sort`(`LATEST` 기본 / `RELEASED` / `NAME`), `page`(1부터, 기본 1). 페이지 크기는 서버 고정 8. 잘못된 값은 400 `INVALID_WORK_LIST_QUERY`. 필터 변경 때 page를 1로 되돌린다.
- 목록 항목 `{ workId, category, title, posterUrl, caseCount }`, 상세 `{ workId, title, category, author, releasedOn, summary, posterUrl }`. category는 이름 문자열이며 id가 아니다. 수정 화면의 categoryId는 카테고리 목록에서 이름으로 찾아 초기값을 정하고, 못 찾으면 사용자가 다시 고르게 한다.
- 등록/수정은 FormData: `data`는 `new Blob([JSON.stringify(body)], { type: 'application/json' })`, `poster`는 파일. multipart Content-Type/boundary를 손으로 지정하지 않는다.
- 필드 `{ categoryId, title, author, releasedOn(YYYY-MM-DD), summary }`. title·author 필수 1~100자(strip 후), releasedOn 필수, summary는 선택이며 최대 100자. 존재하지 않는 categoryId는 400 `WORK_INPUT_INVALID`. 제목 중복 409 `WORK_TITLE_ALREADY_EXISTS`.
- 포스터는 선택이다. 등록 때 없으면 서버가 기본 이미지(`/images/default-poster.svg`)를 넣고, 수정 때 없으면 기존 이미지를 유지한다. 기존 포스터를 지우고 기본 이미지로 되돌리는 요청은 없다.
- 포스터는 JPG/PNG, **500KB(500 × 1024바이트) 이하**이며 요청 전체는 1MB 이하이다. 초과 400 `POSTER_TOO_LARGE`, 형식 오류 400 `POSTER_INVALID_FORMAT`. 업로드 전에 같은 기준으로 미리 검사한다.
- 삭제는 소프트 삭제이며 그 작품의 사건도 함께 숨겨진다. 이미 끝난 재판 기록은 남는다.
- 소개 초안 `{ title, author }`(각 1~100자) → `{ summary }`(100자 이내). 입력 오류 400 `WORK_DRAFT_INPUT_INVALID`, AI 실패 502 `AI_UPSTREAM_ERROR`. 실패하면 사용자가 적은 값을 지우지 않는다. 결과는 summary 입력의 초안일 뿐 저장이 아니다.

### 사건 목록·준비

- 사건 목록 결과 `{ progress: { done, total }, cases: [...] }`. 사건 항목 `{ caseId, suspect, victim, question, difficulty: { def, pro }, penalties: [{ tier, sentence }], my: { def, pro } }`.
- `my.def`·`my.pro`는 해당 역할 기록이 있으면 `{ penaltyTier, sentence }`, 없으면 null이다(Swagger 설명의 "null로 응답"은 옛 내용).
- 난이도는 `EASY` / `NORMAL` / `HARD`. 서버가 근거 카드 가중치 합 차이(±6)로 계산하므로 프론트에서 다시 계산하지 않는다.
- 준비 결과 `{ case: { question, suspect, victim, summary }, roles: { def: { difficulty, recorded }, pro: {...} }, penalties }`. progress(사건 경과)는 준비 응답에 없다.
- **역할마다 기록은 하나뿐이다.** recorded=true인 역할로 시작하면 409 `ROLE_ALREADY_RECORDED`이므로 그 역할 선택을 막고 기록 보기로 안내한다. 두 역할 모두 기록되면 재판 시작을 비활성화한다.

### 사건 등록·수정·삭제 (관리자)

- 등록 본문 `{ workId, question, suspect, victim, summary, progress, cards, penalties }`. 결과 result는 새 caseId(정수).
- 길이: question 1~100, suspect·victim 1~50, summary 1~1000, progress 1~1000(초과 시 `CASE_PROGRESS_TOO_LONG`).
- cards 항목 `{ side, title, body, weight }`: side `PROSECUTION`/`DEFENSE`, title 1~20, body 1~100, weight 정수 1~20(`CARD_WEIGHT_INVALID`). 등록 때 진영별 3장 이상(`CASE_CARD_COUNT_INSUFFICIENT`).
- penalties: tier 1~6을 한 번씩 정확히 6개, sentence 1~50(`PENALTY_TIER_COUNT_INVALID` / `CASE_INPUT_INVALID`). 형벌 내용을 클라이언트가 지어내 확정하지 않는다.
- 하나라도 실패하면 사건·카드·형벌표 모두 저장되지 않는다. 오류 후 편집값을 유지한다.
- 수정 화면은 `GET /api/admin/cases/{caseId}`로 채운다. 결과 `{ workId, question, suspect, victim, summary, progress, cards: [{ id, side, title, body, weight }], penalties, difficulty, weightSum: { def, pro } }`.
- 수정 본문 `{ question, suspect, victim, summary, progress, cards, deletedCardIds, penalties }`:
  - 사건 텍스트 5개는 전체 교체(모두 필수).
  - cards는 **추가·수정할 카드만**. id가 없거나 0이면 새 카드, 1 이상이면 그 카드 수정. 기존 카드의 side는 바뀌지 않는다. 바뀌지 않은 카드는 빼도 된다. 빈 배열이면 카드 변경 없음.
  - deletedCardIds는 삭제할 카드 id. cards와 겹치거나 cards 안에서 id가 중복되면 400. 삭제 후 진영별 3장 이상 남아야 한다. 사건에 없는 id는 404 `EVIDENCE_CARD_NOT_FOUND`.
  - penalties는 바뀐 tier만 보내도 된다. 보내지 않은 tier는 유지된다.
- 화면의 가중치 합·난이도 미리보기는 편집 중 표시용이다. 저장 후에는 서버 응답(목록·상세)을 다시 읽어 표시한다.
- 삭제는 소프트 삭제(204)이며 목록·상세·준비에서 빠진다. 근거 카드·형벌표·재판 기록은 남는다.

### 재판과 기록

- 시작 요청 `{ caseId, role: PROSECUTION | DEFENSE, mode: CHICKEN | CHALLENGER | IRON }`. 잘못된 값은 400 `TRIAL_ROLE_INVALID` / `TRIAL_MODE_INVALID`, 없는 사건 404 `CASE_NOT_FOUND`, 이미 기록된 역할 409 `ROLE_ALREADY_RECORDED`.
- 시작 결과 `{ trialId, stage: "OPENING", cards?, progress?, openingSpeaking? }`. 모드상 비공개 값은 키 자체가 빠진다. cards는 CHICKEN에서 빈 목록(공방 전)이므로 전체 카드 목록으로 사용하지 않는다. 현재 논점에 대응하는 사용자 측 카드 한 장은 CHICKEN의 stage·상태 응답 card(`{ cardId, side, title, body, weight, roundWeight }`)에서만 제공한다. 검사에게는 현재 검사 카드, 변호인에게는 선정된 변호인 대응 카드를 주며 대응 카드가 없으면 생략한다. weight는 카드 원래 가중치, roundWeight는 기존 검사 카드 기준 공방 평가 가중치이며 재판 화면에는 후자를 `공방 가중치`로 표시한다. 카드 원문은 모두 진술·최후 변론과 다른 모드에서는 생략한다. progress는 CHALLENGER에서만 온다. 시작 응답에 score는 없다(시작 게이지는 50).
- 사용자가 변호인이면 서버가 시작 중에 검사 AI 모두 진술을 만들어 openingSpeaking으로 준다. 그래서 시작 요청이 몇 초 걸릴 수 있다. 검사 말풍선을 별도로 만들거나 AI를 다시 호출하지 않는다.
- 진행 중 trialId는 UUID 문자열(서버 메모리), 판결 응답의 trialId는 DB 정수이다. 둘을 다른 이름으로 분리해 관리한다.
- 진행 순서(서버가 관리): 모두 진술 2 → 공방 카드마다 6발언(검사 공격·변호인 반론 ×3) → 최후 변론 2. 모든 단계에서 검사가 먼저 말한다. 카드는 기본 2장이며, 2장 공방 직후 게이지가 47~53이면 3번째 카드가 추가된다(전체 16 또는 22발언). 프론트는 이 규칙으로 턴을 계산하지 않고 서버 이벤트만 따른다.
- 서버 메모리의 진행 판 정리(TrialSessionStore): 같은 사용자가 새 재판을 시작하면 이전 판은 즉시 덮어써진다. 마지막 활동(시작·발언 제출) 뒤 30분이 지난 판은 만료로 보며, 별도 스케줄러 없이 다음 조회·저장 시점에 지워진다(만료된 판은 조회 시 404). 화면 이탈 후 진행 판의 정리는 이 서버 규칙과 나가기(DELETE)에 맡기고, 프론트는 자기 메모리 상태만 비운다.
- topic은 모든 모드에서 공통 공방 논점으로 표시한다. card는 사용자 역할과 side가 일치할 때만 표시하며, CHICKEN 공방에서 card가 없으면 직접 대응하는 근거 카드가 없음을 안내한다. 실패한 턴에서는 카드와 함께 topic도 이전 확정 상태로 복구한다.
- 상태 결과 `{ stage, cardNo?, exchangeNo?, topic?, card?, score?, speakings: [{ seq, stage, side, speaker, content, grade?, issue?, evidence?, rebut?, novel?, delta?, scoreAfter? }] }`. 발언이 모두 끝났으면 stage=CLOSING이고 cardNo·exchangeNo가 빠진다.
- **재판 이탈 정책(팀 합의):** 판결 전에 어떤 방식으로든 재판 화면을 벗어나면(나가기 버튼, 앱 안 다른 화면 이동, 뒤로 가기, 새로고침, 탭 닫기) 그 판은 끝난 것으로 본다. 서버 메모리에 판이 남아 있더라도 다시 접근하지 않으며, 기록도 저장되지 않는다.
  - 진행 중 판의 trialId·발언·카드·경과는 재판 화면의 메모리 상태로만 둔다. sessionStorage·localStorage·URL에 보관해 되살리지 않는다.
  - 새로고침 등으로 재판 화면에 다시 들어오면 진행 상태가 없으므로 "재판이 종료되어 이어갈 수 없음"을 알리고 준비 화면(같은 사건)으로 안내한다. `GET /api/trials/{trialId}`로 이전 판을 되살리지 않는다.
  - 나가기 버튼과 앱 안 이동은 확인 모달에서 "진행 내용이 저장되지 않음"을 알린 뒤 `DELETE /api/trials/{trialId}`(204, 이미 없어도 204)를 보내고 이동한다. 새로고침·탭 닫기는 `beforeunload` 경고를 띄우고, 실제로 떠날 때(`pagehide`) `fetch(..., { method: 'DELETE', keepalive: true })`로 Authorization을 붙여 최선 노력으로 보낸다(Swagger 설명과 같은 방향). 이때 DELETE 성공을 보장한다고 주장하지 않는다(서버에 남은 판은 30분 무활동 만료 또는 같은 사용자의 새 판 시작으로 정리된다). 서버 정리 여부와 관계없이 프론트는 이탈 즉시 그 판을 끝난 것으로 다룬다.
  - DELETE 실패는 이동을 막지 않는다. 이탈한 판은 어떤 경우에도 기록 목록·통계에 나타나지 않는다.
- `GET /api/trials/{trialId}`는 재판 화면 안에서만 쓴다. 발언 스트림이 turn_done 없이 끊겼을 때 서버 상태를 확인하거나, 공방 번호를 맞출 때(6장) 부른다. 404 `TRIAL_NOT_FOUND`(서버 재시작·30분 경과·다른 판 시작)면 판이 끝난 것으로 보고 준비 화면으로 안내한다. 기록이 만들어졌다고 추정하지 않는다.
- 판결은 발언이 모두 끝난 뒤에만 가능하다(아니면 400 `VERDICT_STAGE_INVALID`). AI 총평 때문에 몇 초 걸린다. 결과 `{ trialId(DB), score, penaltyTier, title, sentence, judgeSummary, oppositeAvailable }`. 판결 뒤에는 상태 조회가 404가 되므로 진행 중 상태를 비우고 이후 화면은 DB trialId로만 다룬다.
- oppositeAvailable=true일 때만 "(반대 역할)로 다시하기"를 보여 준다. 준비 화면은 recorded로 제어한다.
- 형벌 단계(ScoreRule): 게이지 0~100에서 ≤16→1, ≤33→2, ≤50→3, ≤66→4, ≤83→5, 나머지 6. title은 1~3 "무죄 3·2·1단계", 4~6 "유죄 1·2·3단계"이며 서버가 준다. 승패는 변호인 1~3, 검사 4~6이면 승리.
- 역할별 결과 이름: penaltyTier 1~6에 대해 DEFENSE는 완승/승리/진땀승/진땀패/패배/완패, PROSECUTION은 그 역순.
- 기록 `GET /api/trials/{trialId}/record`(DB id) 결과 `{ role, mode, score, penaltyTier, title, sentence, judgeSummary, speakings: [{ seq, stage, side, speaker, content, checks: { issue, evidence, rebut, novel }, grade, delta, scoreAfter }], keyMoments }`. 판결 뒤라 모드와 관계없이 전부 공개된다. keyMoments는 강조할 발언 seq 3개이다. 남의 기록은 403 `TRIAL_ACCESS_DENIED`, 없으면 404 `TRIAL_RECORD_NOT_FOUND`.
- 사건 기록 요약 `{ def, pro, latest }`. def·pro는 `{ trialId, mode, score, penaltyTier }` 또는 null, latest는 먼저 보여 줄 역할 탭(`PROSECUTION`/`DEFENSE`) 또는 null. 삭제된 사건도 기록은 조회된다.
- 내 기록 쿼리: `role`(PROSECUTION/DEFENSE), `outcome`(WIN/LOSE), `workId`, `cursor`. 페이지 크기 10, 최신순. 결과 `{ items: [{ trialId, workTitle, question, role, penaltyTier, caseDeleted }], nextCursor }`. 다음 요청은 nextCursor를 cursor로 넘기고 null이면 중단한다. 필터 오류 400 `INVALID_TRIAL_LIST_FILTER`, 커서 오류 400 `INVALID_CURSOR`. 작품의 page 방식과 혼용하지 않는다.
- caseDeleted=true 기록은 저장된 스냅샷(workTitle·question)으로 표시하고 작품·사건 상세로 가는 링크를 막는다.
- 내 통계 `{ total, byRole: { def: { total, win, lose }, pro: {...} }, distribution: { def: [6], pro: [6] } }`. distribution 배열의 0번이 1단계이다.

| 진행 중 공개 항목 | CHICKEN | CHALLENGER | IRON |
|---|---|---|---|
| 게이지(score·scoreAfter)·변화량(delta) | 공개 | 공개 | 비공개 |
| 판정 4항목·등급(grade) | 공개 | 비공개 | 비공개 |
| 현재 논점의 내 쪽 카드(stage·상태 응답 card) | 대응 카드 1장 공개 | 비공개 | 비공개 |
| 사건 경과(시작 응답 progress) | 비공개 | 공개 | 비공개 |

비공개 필드는 키가 빠지거나 빈 객체로 온다. 누락·null·`{}`를 정상 처리하고, 숨긴 필드를 0이나 false로 채워 표시하지 않는다. 이전 판·모드의 데이터가 남아 노출되지 않게 상태를 초기화한다.
등급 값은 `STRONG` / `OK` / `WEAK` / `OFF`이다.

## 6. 스트리밍·AI·검수

### 발언 POST SSE

- 본문 `{ content }`, 1~300자(Java length). POST와 Authorization이 필요하므로 EventSource 대신 fetch를 쓴다.
- SSE를 열기 전 검사 실패는 일반 JSON 오류다: 401(인증), 404 `TRIAL_NOT_FOUND`, 403 `TRIAL_ACCESS_DENIED`, 400 `SPEAKING_NOT_YOUR_TURN`(처리 중 중복 제출 포함), 400 `SPEAKING_CONTENT_INVALID`. HTTP 상태와 Content-Type을 확인한 뒤 JSON/SSE를 분기한다.
- 요청 전 상태와 스트리밍 중 상태를 구분하고 중복 제출을 막는다. 진행 요청을 자동 재시도하지 않는다.
- 서버(Spring SseEmitter)는 `event:이름` / `data:JSON` 줄을 콜론 뒤 공백 없이 보낸다. 파서는 공백 유무, UTF-8 분할, 청크와 이벤트 경계 불일치, CRLF, 여러 data 줄, 끝나지 않은 버퍼를 처리한다. data는 항상 JSON이다.
- 이벤트와 data:

| event | data | 처리 |
|---|---|---|
| judge | `{ checks?, grade?, delta?, scoreAfter? }` | 내 발언 판정. IRON은 `{}` |
| opponent_delta | `{ text }` | 상대 말풍선에 누적 |
| opponent_judge | judge와 같은 모양 | 상대 발언 판정 |
| stage | `{ stage, cardNo?, exchangeNo?, topic?, card? }` | 단계·카드가 바뀔 때만 옴 |
| turn_done | `{ nextTurn: "USER" \| "VERDICT" }` | 턴 확정 |
| error | `{ status, code, message, retryable, failCount }` | 실패로 스트림 종료 |

- 기본 순서: judge → opponent_delta 여러 번 → opponent_judge → (단계·카드가 바뀌면) stage → turn_done. 내 발언이 마지막이면 상대 이벤트 없이 judge → turn_done(VERDICT)이다.
- checks는 `{ issue, evidence, rebut, novel }`이며 rebut=null(모두 진술, 각 카드 첫 검사 공격)은 판정 제외로 표시한다. CHALLENGER는 delta·scoreAfter만 온다.
- CHICKEN은 현재 card 한 장만 표시하며, card.side를 그대로 사용한다. 시작 cards나 카드 번호로 전체 목록·현재 카드를 추측하지 않는다. stage로 임시 변경한 카드·단계·구분선은 실패·끊김 시 전송 전 상태로 복원한다.
- stage 이벤트는 카드 안 공방 번호(exchangeNo)가 바뀔 때마다 오지 않는다. 시안이 공방 번호를 표시하면 turn_done 뒤 상태 API로 맞추고, 프론트에서 턴 규칙으로 계산하지 않는다.
- turn_done의 nextTurn=USER에서만 다음 입력을 열고, VERDICT에서 판결 요청을 허용한다. 받은 글자 수로 종료를 판단하지 않는다.
- 서버는 turn_done 때만 그 턴을 반영한다. error나 연결 끊김이면 그 발언 전체(내 발언·상대 발언·판정)가 반영되지 않는다. 화면도 임시 턴 상태를 버리고 마지막 확정 상태로 되돌리며 입력 원문을 보존한다. 같은 발언을 다시 보내면 된다.
- 스트림 EOF만으로 성공을 확정하지 않는다. turn_done 없이 끊기면 상태 API로 서버 상태를 확인한다.
- error의 retryable=false(설정 문제 503 `AI_CONFIGURATION_MISSING`)면 재시도 버튼을 비활성화한다. failCount는 연속 실패 횟수이며 3 이상이면 나가기를 권한다. 코드는 `AI_JUDGE_FAILED`, `AI_OPPONENT_FAILED`, `AI_TIMEOUT`, `AI_CONFIGURATION_MISSING`, `INTERNAL_SERVER_ERROR`.
- 한 턴은 AI를 세 번 부르므로 오래 걸릴 수 있다(서버 SSE 제한 180초). 프론트가 더 짧은 타임아웃으로 끊지 않는다.
- 화면 이탈 시 AbortController로 연결을 끊는다(서버는 그 턴을 반영하지 않고 실패로 세지 않음). 판결 요청 중에는 중복 호출·중복 이동을 막는다.

### 관리자 AI WebSocket

| 연결 경로 | step | 권한 |
|---|---|---|
| /ws/admin/case-draft | CANDIDATES, REWRITE (+ hello) | ADMIN, SUPER_ADMIN |
| /ws/admin/evidence-card-draft | CARDS, CARD_SUGGEST | ADMIN, SUPER_ADMIN |
| /ws/admin/penalty-draft | PENALTY | ADMIN, SUPER_ADMIN |

- 네이티브 WebSocket을 쓴다. SockJS/STOMP를 도입하지 않는다. 주소는 기준 주소의 http를 ws로 바꿔 만든다.
- 연결 후 첫 메시지는 `{ type: "auth", token }`. URL 쿼리에 JWT를 넣지 않는다. 인증 실패·권한 부족·인증 전 다른 메시지는 close code **1008**로 닫힌다. 1008은 인증/권한 실패로 처리하고 자동 재연결하지 않는다.
- auth 성공 응답은 없다. case-draft에서만 `{ type: "hello" }` → `done { json: { connected: true } }`로 연결 상태를 확인할 수 있다. 다른 경로는 auth 직후 바로 draft를 보낸다.
- 요청은 `{ type: "draft", step, workId, ... }`. 서버 응답 메시지는 `delta { text }`, `done { json }`, `error { status, code, message }` 세 종류다.
- **현재 세 경로 모두 delta를 보내지 않고 완성된 결과를 done 한 번으로 보낸다.** 완료 전까지 로딩을 표시하고, delta가 오면 미리보기에만 쓴다. 최종 폼 반영은 done의 json 기준이다.
- 한 연결에서 AI 작업은 한 번에 하나다. 실행 중에 또 보내면 error `WS_DRAFT_REQUEST_INVALID`이다. 요청값 오류도 같은 코드이며 연결은 유지된다. AI 실패는 `AI_UPSTREAM_ERROR`(502), `AI_TIMEOUT`(504), `AI_CONFIGURATION_MISSING`(503), `INTERNAL_SERVER_ERROR`.
- 중단은 `{ type: "cancel" }`. 응답은 없고, 중단된 작업은 done·error를 보내지 않는다. 화면 이탈 시 연결을 닫는다(서버가 작업을 멈춤).
- 공통 사건 필드 검증(Java length): question 1~100, suspect·victim 1~50, summary·progress 1~1000. workId는 활성 작품이어야 한다.

| step | 요청 추가 필드 | done.json |
|---|---|---|
| CANDIDATES | `excludeQuestions?: string[]` (다시 받기 때 이전 후보 question) | `[{ question, suspect, victim, summary, progress }]` 3개 |
| REWRITE | `question, suspect, victim, summary, progress, feedback` 모두 필수 | `{ summary, progress }` |
| CARDS | `side`, 공통 사건 필드, `cards?: [{ side, title, body, weight? }]`(화면의 다른 카드, 최대 20) | `{ side, title, body, weight }` 1장 |
| CARD_SUGGEST | `card: { side, title, body, weight }`, 공통 사건 필드, `cards?` | `{ side, message, title, body, weight, changed }` |
| PENALTY | 공통 사건 필드, `excludeSentences?: string[]`(이전 처분, 최대 60개·각 100자) | `[{ tier, title, sentence }]` 6개 (tier 1→6) |

- case-draft에서 없는 작품은 error `WORK_NOT_FOUND`, 카드·형벌 경로에서는 `WS_DRAFT_REQUEST_INVALID`로 온다.
- AI 결과는 글자 수 제한(카드 title 20·body 100, sentence 50)을 넘을 수 있다(서버는 경고만 남김). 저장 전에 화면에서 사건 등록 기준으로 검증하고 초과를 표시한다.
- 형벌 초안의 title은 표시용이다. 사건 저장에는 `{ tier, sentence }`만 보낸다. CARD_SUGGEST의 changed=false면 "변경 없음"으로 표시한다.
- AI 결과는 관리자 편집 초안이다. 사용자가 수정한 내용을 확인 없이 덮어쓰거나 저장 완료로 표시하지 않는다. 실패 시 기존 편집값을 유지한다.

### 완료 검수

아래 명령과 브라우저 검수는 **앱 구현 후** 수행한다.

```bash
npm run lint
npm run build
```

- tokens.css·tokens.json이 시안 원본과 같은지 확인한다. 컴포넌트 CSS에 HEX가 없는지 검색한다(`--primary`, `--on-primary` 정의 제외).
- 실제 서버 로그인 → 작품 → 사건 목록 → 준비 → 검사/변호인 → 3모드 → 판결 → 기록 → 반대 역할을 확인한다.
- 관리자 카테고리·작품 관리·사건 등록/수정/삭제·AI 3경로·슈퍼 관리자 계정 화면을 실제 응답으로 확인한다.
- 라이트·다크·각 고대비와 system 테마의 OS 변경 반영, 키보드 이동, 긴 텍스트, 포스터 로드 실패를 PC 브라우저에서 확인한다.
- SSE는 청크 분할/한글 분할/공백 없는 `data:`/중간 error/IRON 빈 판정/turn_done 누락, 인증 만료, 중복 제출을 의미 있는 소규모 테스트로 검증한다.
- 재판 중 나가기·뒤로 가기·새로고침 후 이어가기가 불가능하고 기록·통계에 남지 않는지 확인한다.
- 200·201·204 빈 본문, 서로 다른 응답 래퍼, 스트림 끊김 후 상태 404, 409 역할 기록 충돌, WS 1008 종료와 초안 실패 후 편집 보존을 확인한다.
- Mock은 화면/오류 검증용으로만 사용하고 실제 API 연결 완료의 근거로 제시하지 않는다.
- 린트·빌드·미확인 항목·현재 연결 불가 기능을 분리해 보고한다. 연결 불가 항목이 남으면 전체 구현 완료라고 단정하지 않는다.
- 커밋은 `타입: 한글 설명`(feat, fix 등), 기능별 `feature/*` 브랜치 → `develop`을 따른다. 사용자 요청 없이 merge/push/배포하지 않는다.

## 현재 연결 제한 (2026-10-21 기준)

| 항목 | 상태 | 이유 |
|---|---|---|
| 기본 포스터로 되돌리기 | 요청 없음 | 수정 시 포스터를 빼면 기존 이미지 유지 |
| 재판 중 새로고침 복원 | 하지 않음(합의) | 어떤 이탈이든 그 판은 종료·미저장. 5장 "재판 이탈 정책" 참고 |
| AI 초안 실시간 글자 | 미지원 | WS 세 경로 모두 delta 없이 done만 보냄 |

- 미확인: 시안 전체 화면의 세부 실측, 실행 서버의 실제 JSON·스트림, 빌드와 브라우저 동작. 구현 단계에서 검증한다. 이 문서가 서버 동작 검증이나 프론트 구현을 대신하지 않는다.
