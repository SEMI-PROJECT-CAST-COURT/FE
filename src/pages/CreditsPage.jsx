import { Page } from '../components/Layout';
import styles from './InfoPages.module.css';

export default function CreditsPage() {
  return (
    <Page width="narrow" gap="lg">
      <div className={styles.head}>
        <h1 className={styles.h1}>저작권 · 크레딧</h1>
        <p className={styles.lead}>
          CAST COURT는 수업 과제·포트폴리오용 <strong className={styles.strong}>비영리 프로젝트</strong> · 외부 배포 없음, 시연 영상과 GitHub 공개용
        </p>
      </div>
      <section className={styles.sectionTight}>
        <h2 className={styles.h2}>작품과 이미지</h2>
        <ul className={styles.list}>
          <li>작품과 등장인물의 저작권은 각 원작 권리자에게 있음 · 원작 권리자와 관계없는 비공식 프로젝트</li>
          <li>작품 이미지는 관리자가 직접 올린 파일 · 이미지 권리도 각 권리자에게 있음</li>
          <li>판사·검사·변호인 아이콘과 화면 디자인은 팀 자체 제작</li>
          <li>권리자 요청 시 해당 내용 즉시 삭제</li>
        </ul>
      </section>
      <section className={styles.sectionTight}>
        <h2 className={styles.h2}>AI 사용 안내</h2>
        <ul className={styles.list}>
          <li>작품 줄거리, 사건 개요·경과, 근거 카드, 형량표 초안은 OpenAI 언어 모델이 생성 · 관리자 검토 후 등록</li>
          <li>재판 중 AI 상대(검사·변호인)와 AI 판사의 문장도 같은 모델이 생성</li>
          <li>AI 판사는 발언마다 4가지 확인 항목에만 응답 · 점수와 판결은 서버 계산</li>
          <li>AI 생성 내용은 원작과 다를 수 있음 · 판결은 놀이일 뿐 실제 법적 판단 아님</li>
        </ul>
      </section>
      <section className={styles.credits}>
        <div className={styles.creditBox}>
          <span className={styles.muted}>만든 사람</span>
          <span>[팀 이름] · [팀원 4명]</span>
          <span className={styles.creditSub}>[수업 과정 이름]</span>
        </div>
        <div className={styles.creditBox}>
          <span className={styles.muted}>문의 · 삭제 요청</span>
          <span>[팀 이메일]</span>
        </div>
      </section>
    </Page>
  );
}
