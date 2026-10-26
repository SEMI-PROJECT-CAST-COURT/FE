import { useState } from 'react';
import Icon from './Icon';
import { assetUrl } from '../api/client';
import styles from './Poster.module.css';

// 작품 포스터: 서버 상대 경로 + 기준 주소. 실패하면 공통 이미지 자리(--surface-4)
export default function Poster({ src, alt, className = '', placeholder = '작품 이미지' }) {
  const [failed, setFailed] = useState(null);
  const url = assetUrl(src);
  if (!url || failed === url) {
    return (
      <div className={`${styles.empty} ${className}`} role="img" aria-label={`${alt} 포스터 없음`}>
        <Icon name="image" size="32px" />
        <span className={styles.caption}>[{placeholder}]</span>
      </div>
    );
  }
  return <img src={url} alt={`${alt} 포스터`} className={`${styles.img} ${className}`} onError={() => setFailed(url)} loading="lazy" />;
}
