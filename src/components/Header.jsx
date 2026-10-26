import { Link, NavLink } from 'react-router';
import Icon from './Icon';
import Logo from './Logo';
import { useAuth } from '../store/auth';
import styles from './Header.module.css';

// 권한별 메뉴: 슈퍼 관리자 → 계정 관리 링크, 관리자 → 배지, 로그인 → 닉네임(내 기록)·로그아웃, 비로그인 → 로그인
// 메뉴 숨김은 편의 처리이고 최종 권한은 서버가 판단한다.
export default function Header() {
  const { token, nickname, authority } = useAuth();
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link to="/works" className={styles.home} aria-label="CAST COURT 작품 목록">
          <Logo />
        </Link>
        <nav className={styles.menu} aria-label="사용자 메뉴">
          {authority === 'SUPER_ADMIN' ? (
            <NavLink to="/admin/accounts" className={({ isActive }) => `${styles.admin} ${isActive ? styles.adminOn : ''}`}>
              <Icon name="admin" size="sm" />
              슈퍼 관리자
            </NavLink>
          ) : null}
          {authority === 'ADMIN' ? (
            <span className={styles.admin}>
              <Icon name="admin" size="sm" />
              관리자
            </span>
          ) : null}
          {token ? (
            <>
              <NavLink to="/me/records" className={({ isActive }) => `${styles.pill} ${isActive ? styles.pillOn : ''}`}>
                <Icon name="user" size="md" />
                {nickname}님
              </NavLink>
              <Link to="/logout" className={styles.logout}>
                <Icon name="logout" size="md" />
                로그아웃
              </Link>
            </>
          ) : (
            <Link to="/login" className={styles.login}>
              로그인
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
