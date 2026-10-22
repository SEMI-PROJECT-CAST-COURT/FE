import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Page } from '../components/Layout';
import Button from '../components/Button';
import Chip from '../components/Chip';
import Icon from '../components/Icon';
import Pagination from '../components/Pagination';
import Poster from '../components/Poster';
import { Empty, ErrorState, Loading } from '../components/States';
import CategoryEditor from './admin/CategoryEditor';
import { fetchCategories } from '../api/categories';
import { fetchWorks } from '../api/works';
import { isAdminAuthority, useAuth } from '../store/auth';
import styles from './WorksPage.module.css';

const SORTS = [
  { value: 'LATEST', label: '등록 최신순' },
  { value: 'RELEASED', label: '공개일순' },
  { value: 'NAME', label: '이름순' },
];

// 검색 · 정렬 · 카테고리 · 페이지는 URL 쿼리로 관리한다. 필터가 바뀌면 page 는 1로.
export default function WorksPage() {
  const [params, setParams] = useSearchParams();
  const categoryId = Number(params.get('categoryId')) || null;
  const keyword = params.get('keyword') ?? '';
  const sort = SORTS.some((s) => s.value === params.get('sort')) ? params.get('sort') : 'LATEST';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const isAdmin = isAdminAuthority(useAuth((s) => s.authority));
  const [draft, setDraft] = useState(keyword);
  const [syncedKeyword, setSyncedKeyword] = useState(keyword);
  const [catOpen, setCatOpen] = useState(false);
  if (syncedKeyword !== keyword) {
    setSyncedKeyword(keyword);
    setDraft(keyword);
  }

  const categories = useQuery({ queryKey: ['categories'], queryFn: fetchCategories });
  const works = useQuery({
    queryKey: ['works', { categoryId, keyword, sort, page }],
    queryFn: () => fetchWorks({ categoryId, keyword, sort, page }),
    placeholderData: keepPreviousData,
  });

  const update = (next) => {
    const merged = { categoryId, keyword, sort, page: 1, ...next };
    const sp = new URLSearchParams();
    if (merged.categoryId) sp.set('categoryId', merged.categoryId);
    if (merged.keyword) sp.set('keyword', merged.keyword);
    if (merged.sort && merged.sort !== 'LATEST') sp.set('sort', merged.sort);
    if (merged.page > 1) sp.set('page', merged.page);
    setParams(sp);
  };

  const data = works.data;
  return (
    <Page gap="md">
      <div className={styles.titleRow}>
        <div className={styles.titleBox}>
          <div className={styles.count}>재판할 수 있는 작품 {data ? data.totalElements : '-'}개</div>
          <h1 className={styles.h1}>작품 목록</h1>
        </div>
        {isAdmin ? (
          <Button variant="admin" to="/admin/works/new">
            <Icon name="plus" size="md" />새 작품
          </Button>
        ) : null}
      </div>

      <div className={styles.chips} role="group" aria-label="카테고리">
        <Chip size="lg" pressed={!categoryId} onClick={() => update({ categoryId: null })}>
          전체
        </Chip>
        {(categories.data ?? []).map((c) => (
          <Chip key={c.categoryId} size="lg" pressed={categoryId === c.categoryId} onClick={() => update({ categoryId: c.categoryId })}>
            {c.name}
          </Chip>
        ))}
        {categories.isError ? <span className={styles.catError}>카테고리를 불러오지 못했습니다</span> : null}
        {isAdmin ? (
          <Button variant="admin" className={styles.catEdit} onClick={() => setCatOpen(true)}>
            카테고리 편집
          </Button>
        ) : null}
      </div>

      <div className={styles.filters}>
        <form
          className={styles.search}
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            update({ keyword: draft.trim() });
          }}
        >
          <Icon name="search" size="18px" className={styles.searchIcon} />
          <label htmlFor="work-search" className="sr-only">
            작품 검색
          </label>
          <input id="work-search" type="search" className={styles.searchInput} placeholder="작품 제목으로 검색" value={draft} onChange={(e) => setDraft(e.target.value)} />
          {keyword ? (
            <button type="button" className={styles.clear} onClick={() => update({ keyword: '' })}>
              검색 지우기
            </button>
          ) : null}
        </form>
        <label className={styles.sortLabel}>
          <span>정렬</span>
          <select className={styles.sort} value={sort} onChange={(e) => update({ sort: e.target.value })}>
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {works.isPending ? <Loading label="작품 불러오는 중" /> : null}
      {works.isError ? <ErrorState error={works.error} onRetry={() => works.refetch()} /> : null}
      {data && data.content.length === 0 ? (
        <Empty title="조건에 맞는 작품 없음">{keyword ? `"${keyword}"가 제목에 들어간 작품이 없음` : '아직 등록된 작품이 없음'}</Empty>
      ) : null}
      {data && data.content.length > 0 ? (
        <div className={styles.grid} aria-busy={works.isFetching || undefined}>
          {data.content.map((w) => (
            <Link key={w.workId} to={`/works/${w.workId}`} className={styles.card}>
              <div className={styles.poster}>
                <Poster src={w.posterUrl} alt={w.title} />
              </div>
              <div className={styles.cardBody}>
                <div className={styles.cat}>{w.category}</div>
                <div className={styles.workTitle}>{w.title}</div>
                <div className={styles.caseCount}>사건 {w.caseCount}개</div>
              </div>
            </Link>
          ))}
        </div>
      ) : null}
      {data && data.totalPages > 0 ? (
        <Pagination page={Math.min(page, data.totalPages)} totalPages={data.totalPages} onChange={(n) => update({ page: n })} />
      ) : null}

      {isAdmin ? <CategoryEditor open={catOpen} onClose={() => setCatOpen(false)} /> : null}
    </Page>
  );
}
