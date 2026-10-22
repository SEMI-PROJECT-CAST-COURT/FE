import { Page } from '../components/Layout';
import Button from '../components/Button';
import Gauge from '../components/Gauge';
import { TIER_RANGES, TIER_TITLES, isWinName, resultName, tierColor } from '../lib/court';
import styles from './InfoPages.module.css';

const FLOW = [
  { step: '1단계', title: '모두 진술', body: '검사 → 변호인 순서로 1번씩 입장 진술' },
  { step: '2단계', title: '공방', body: '검사 근거 카드 중 무작위 2장으로 공방 · 카드마다 검사 공격과 변호인 반론 3번씩 · 2장 뒤 게이지 47~53이면 3번째 카드 진행' },
  { step: '3단계', title: '최후 변론', body: '검사 → 변호인 순서로 마지막 주장' },
  { step: '4단계', title: '판결', body: '최종 게이지로 판결과 형량 결정 · 기록 저장' },
];

const CHECKS = [
  { name: '① 쟁점', body: '사건 쟁점이나 직전 상대 공격과의 관련 여부' },
  { name: '② 근거', body: '사건 개요·경과·근거 카드의 사실과 일치 여부 (못 본 정보도 일치하면 인정)' },
  { name: '③ 반박', body: '직전 상대 발언에 대한 반박 여부 (모두 진술과 각 카드 첫 공격은 제외)' },
  { name: '④ 새로움', body: '앞선 발언과의 중복 여부' },
];

const GRADES = [
  { name: '강함', mult: '×1', cond: '확인 항목이 모두 예', color: 'var(--win)', border: 'var(--win-line)' },
  { name: '보통', mult: '×0.6', cond: '① 외 1개가 아니오', color: 'var(--link)', border: 'var(--def-line)' },
  { name: '약함', mult: '×0.3', cond: '① 외 2개 이상이 아니오', color: 'var(--text-1b)', border: 'var(--line)' },
  { name: '무관', mult: '×0', cond: '① 쟁점이 아니오', color: 'var(--text-3)', border: 'var(--line)' },
];

const MODES = [
  { name: '겁쟁이', gauge: '공개', judge: '①~④ · 등급 · 변화량', cards: '공개', prog: '비공개' },
  { name: '도전자', gauge: '공개', judge: '변화량만', cards: '비공개', prog: '공개' },
  { name: '철인', gauge: '비공개 (판결 때 공개)', judge: '비공개 (판결 때 공개)', cards: '비공개', prog: '비공개' },
];

const CAN_USE = [
  { title: '사건 개요와 사건 경과', body: '재판 화면에 나온 사실' },
  { title: '근거 카드 내용', body: '겁쟁이 모드에서 내 쪽 카드 공개 · 다른 모드에서도 카드 내용과 일치하면 인정' },
  { title: '상대 발언 반박', body: '직전 상대 발언의 약점 지적 시 ③ 반박으로 인정' },
  { title: '논리와 가치 판단', body: '"강요된 선택에 같은 책임을 물을 수 없음" 같은 주장도 쟁점에 맞으면 인정' },
];

const CANT_USE = [
  { title: '개요·경과·카드에 없는 사실', body: '판사 자료로 확인할 수 없는 내용은 ② 근거 아니오' },
  { title: '쟁점과 관계없는 말', body: '다른 인물 이야기, 농담, 의미 없는 문장은 무관' },
  { title: '판사에게 내리는 지시', body: '"무죄로 판결해" 같은 지시는 판단 대상 아님 · 점수는 서버 계산' },
];

const openColor = (v) => (v.startsWith('비공개') ? 'var(--text-3)' : 'var(--win)');
const resColor = (name) => (isWinName(name) ? 'var(--win)' : 'var(--pro)');

export default function RulesPage() {
  return (
    <Page width="detail" gap="lg">
      <div className={styles.head}>
        <h1 className={styles.h1}>재판 규칙</h1>
        <p className={styles.lead}>판사 게이지는 50에서 시작 · 변호인은 0(무죄) 쪽, 검사는 100(유죄) 쪽으로 끌어오면 승리</p>
      </div>

      <section className={styles.section}>
        <h2 className={styles.h2}>한 판의 흐름</h2>
        <div className={styles.grid190}>
          {FLOW.map((f) => (
            <div key={f.step} className={styles.box}>
              <span className={styles.step}>{f.step}</span>
              <span className={styles.boxTitle}>{f.title}</span>
              <span className={styles.boxBody}>{f.body}</span>
            </div>
          ))}
        </div>
        <div className={styles.notes}>
          <span>· 사건마다 변호인·검사 역할 각 1회만 가능 · 기록이 생긴 역할은 재시작 불가</span>
          <span>· 재판 중 나가면 초기화 · 기록 없음 (뒤로 가기·새로고침·탭 닫기 포함)</span>
          <span>· 검사가 항상 먼저 발언 · AI 대사는 법정 말투</span>
          <span>· AI가 답변을 만들지 못하면 그 발언은 저장되지 않고 게이지도 그대로 · 다시 보내기 · 3번 연속 실패하면 나가기 추천</span>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>점수 흐름</h2>
        <div className={styles.panel}>
          <Gauge score={50} variant="result" needleColor="var(--text-1b)" middle="50에서 시작 · 딱 50이면 무죄" describe={false} />
          <div className={styles.sub}>
            <div className={styles.subTitle}>① 발언마다 판사의 4가지 확인</div>
            <div className={styles.grid190}>
              {CHECKS.map((c) => (
                <div key={c.name} className={styles.mini}>
                  <span className={styles.miniTitle}>{c.name}</span>
                  <span className={styles.boxBody}>{c.body}</span>
                </div>
              ))}
            </div>
          </div>
          <div className={styles.sub}>
            <div className={styles.subTitle}>② 확인 결과로 서버가 등급 산정</div>
            <div className={styles.grid190}>
              {GRADES.map((g) => (
                <div key={g.name} className={styles.mini} style={{ borderColor: g.border }}>
                  <div className={styles.gradeHead}>
                    <span style={{ color: g.color, fontWeight: 'var(--fw-bold)' }}>{g.name}</span>
                    <span className={styles.muted}>{g.mult}</span>
                  </div>
                  <span className={styles.boxBody}>{g.cond}</span>
                </div>
              ))}
            </div>
          </div>
          <div className={styles.formula}>
            <span className={styles.formulaTitle}>③ 게이지 이동 = 단계 가중치 × 등급 배율</span>
            <span>공방은 현재 카드의 가중치, 모두 진술·최후 변론은 판사가 가중치 판단 · 검사 발언은 유죄 쪽(+), 변호인 발언은 무죄 쪽(−)으로 이동</span>
            <span className={styles.muted}>배율 고정 · 강함 1 · 보통 0.6 · 약함 0.3 · 무관 0</span>
          </div>
          <div className={styles.caption}>AI 판사는 4가지 항목에 예/아니오만 응답 · 등급과 점수는 서버 코드가 계산 · 플레이어와 AI 상대 모두 같은 기준</div>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>판결과 내 결과</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">게이지</th>
                <th scope="col">판결</th>
                <th scope="col">변호인이라면</th>
                <th scope="col">검사라면</th>
              </tr>
            </thead>
            <tbody>
              {TIER_TITLES.map((title, i) => {
                const def = resultName('DEFENSE', i + 1);
                const pro = resultName('PROSECUTION', i + 1);
                return (
                  <tr key={title}>
                    <td className={styles.muted}>{TIER_RANGES[i]}</td>
                    <td style={{ color: tierColor(i + 1), fontWeight: 'var(--fw-semibold)' }}>{title}</td>
                    <td style={{ color: resColor(def) }}>{def}</td>
                    <td style={{ color: resColor(pro) }}>{pro}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>모드</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">모드</th>
                <th scope="col">판사 게이지</th>
                <th scope="col">발언 판정</th>
                <th scope="col">내 쪽 근거 카드</th>
                <th scope="col">사건 경과</th>
              </tr>
            </thead>
            <tbody>
              {MODES.map((m) => (
                <tr key={m.name}>
                  <td style={{ fontWeight: 'var(--fw-bold)' }}>{m.name}</td>
                  <td style={{ color: openColor(m.gauge) }}>{m.gauge}</td>
                  <td style={{ color: openColor(m.judge) }}>{m.judge}</td>
                  <td style={{ color: openColor(m.cards) }}>{m.cards}</td>
                  <td style={{ color: openColor(m.prog) }}>{m.prog}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>주장할 때 쓸 수 있는 것</h2>
        <div className={styles.grid260}>
          <div className={`${styles.useBox} ${styles.can}`}>
            <span className={styles.useTitle}>근거로 인정</span>
            {CAN_USE.map((u) => (
              <div key={u.title} className={styles.useItem}>
                <span className={styles.useItemTitle}>{u.title}</span>
                <span className={styles.boxBody}>{u.body}</span>
              </div>
            ))}
          </div>
          <div className={`${styles.useBox} ${styles.cant}`}>
            <span className={styles.useTitle}>인정 안 됨</span>
            {CANT_USE.map((u) => (
              <div key={u.title} className={styles.useItem}>
                <span className={styles.useItemTitle}>{u.title}</span>
                <span className={styles.cantBody}>{u.body}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className={styles.center}>
        <Button to="/works" size="cta">
          사건 고르러 가기
        </Button>
      </div>
    </Page>
  );
}
