import { Outlet, ScrollRestoration } from 'react-router';
import Header from './Header';
import Footer from './Footer';
import styles from './Layout.module.css';

export default function Layout() {
  return (
    <>
      <a href="#main" className={styles.skip}>
        본문 바로가기
      </a>
      <Header />
      <div id="main" className={styles.body}>
        <Outlet />
      </div>
      <Footer />
      <ScrollRestoration />
    </>
  );
}

// 화면 폭: container 1200 · wide 960 · record 980 · content 820 · detail 920 · narrow 860
export function Page({ width = 'container', className = '', children, gap = 'md', as = 'main' }) {
  const Tag = as;
  return <Tag className={`${styles.page} ${styles[width]} ${styles[`gap-${gap}`]} ${className}`}>{children}</Tag>;
}
