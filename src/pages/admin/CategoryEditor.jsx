import { useRef, useState } from 'react';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import Modal from '../../components/Modal';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import { InlineError, Loading } from '../../components/States';
import { createCategory, deleteCategory, fetchCategories, renameCategory, reorderCategories } from '../../api/categories';
import { fetchWorks } from '../../api/works';
import { codePointLength, strip } from '../../lib/text';
import styles from './CategoryEditor.module.css';

const MAX = 10; // strip 후 1~10자(codePoint)

function validName(name) {
  const value = strip(name);
  if (!value) return '카테고리 이름을 입력해 주세요.';
  if (codePointLength(value) > MAX) return '카테고리 이름은 10자 이하여야 합니다.';
  return null;
}

// 카테고리 편집: 추가 · 삭제는 바로 서버에 반영, 이름 · 순서 변경은 [저장]에서 반영
export default function CategoryEditor({ open, onClose }) {
  return open ? <Editor onClose={onClose} /> : null;
}

function Editor({ onClose }) {
  const qc = useQueryClient();
  const categories = useQuery({ queryKey: ['categories'], queryFn: fetchCategories });
  const [rows, setRows] = useState(null);
  const [seen, setSeen] = useState(null);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState(null);
  const dragIndex = useRef(null);
  const handleRefs = useRef({});

  // 서버 목록이 바뀌면(추가 · 삭제 후) 편집 중인 이름은 유지하면서 행을 다시 맞춘다.
  if (categories.data && categories.data !== seen) {
    setSeen(categories.data);
    setRows((prev) => {
      const edited = new Map((prev ?? []).map((r) => [r.categoryId, r.name]));
      const prevOrder = (prev ?? []).filter((r) => !r.fixed).map((r) => r.categoryId);
      const list = categories.data.map((c) => ({ categoryId: c.categoryId, original: c.name, name: edited.get(c.categoryId) ?? c.name, fixed: c.fixed }));
      const normal = list.filter((r) => !r.fixed);
      normal.sort((a, b) => {
        const ia = prevOrder.indexOf(a.categoryId);
        const ib = prevOrder.indexOf(b.categoryId);
        if (ia === -1 && ib === -1) return 0;
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      });
      return [...normal, ...list.filter((r) => r.fixed)];
    });
  }

  const counts = useQueries({
    queries: (categories.data ?? []).map((c) => ({
      queryKey: ['works', { categoryId: c.categoryId, keyword: '', sort: 'LATEST', page: 1 }],
      queryFn: () => fetchWorks({ categoryId: c.categoryId, page: 1 }),
    })),
  });
  const countOf = (id) => {
    const idx = (categories.data ?? []).findIndex((c) => c.categoryId === id);
    const q = counts[idx];
    return q?.data ? q.data.totalElements : q?.isError ? '?' : '…';
  };

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ['categories'] });
    qc.invalidateQueries({ queryKey: ['works'] });
  };

  const move = (from, to) => {
    setRows((list) => {
      const normalCount = list.filter((r) => !r.fixed).length;
      if (to < 0 || to >= normalCount || from === to) return list;
      const next = list.slice();
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const add = async () => {
    const msg = validName(newName);
    if (msg) {
      setError({ message: msg });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createCategory(strip(newName));
      setNewName('');
      refreshAll();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    setBusy(true);
    setError(null);
    try {
      await deleteCategory(id);
      setConfirmId(null);
      setRows((list) => list.filter((r) => r.categoryId !== id));
      refreshAll();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!rows) return;
    for (const r of rows) {
      if (r.fixed) continue;
      const msg = validName(r.name);
      if (msg) {
        setError({ message: `${r.original}: ${msg}` });
        return;
      }
    }
    setBusy(true);
    setError(null);
    try {
      for (const r of rows) {
        if (!r.fixed && strip(r.name) !== r.original) await renameCategory(r.categoryId, strip(r.name));
      }
      const order = rows.filter((r) => !r.fixed).map((r) => r.categoryId);
      const serverOrder = (categories.data ?? []).filter((c) => !c.fixed).map((c) => c.categoryId);
      if (order.join(',') !== serverOrder.join(',')) await reorderCategories(order);
      refreshAll();
      onClose();
    } catch (err) {
      setError(err);
      refreshAll();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      title="카테고리 편집"
      onClose={busy ? undefined : onClose}
      busy={busy}
      width={440}
      actions={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            취소
          </Button>
          <Button onClick={save} loading={busy} disabled={!rows}>
            저장
          </Button>
        </>
      }
    >
      <span className="sr-only">끌어서 순서 변경 · 손잡이에서 위/아래 화살표 키로도 이동</span>
      {categories.isPending ? <Loading /> : null}
      {categories.isError ? <InlineError error={categories.error} /> : null}
      <ul className={styles.rows}>
        {(rows ?? []).map((r, i) => (
          <li
            key={r.categoryId}
            className={styles.row}
            draggable={!r.fixed}
            onDragStart={() => {
              dragIndex.current = i;
            }}
            onDragOver={(e) => {
              if (!r.fixed) e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragIndex.current !== null) move(dragIndex.current, i);
              dragIndex.current = null;
            }}
          >
            <div className={styles.rowMain}>
              {r.fixed ? (
                <>
                  <Icon name="lock" size="18px" className={styles.handle} />
                  <span className={styles.fixedName}>{r.name}</span>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className={styles.dragBtn}
                    aria-label={`${r.original} 순서 이동 (위/아래 화살표)`}
                    ref={(el) => {
                      handleRefs.current[r.categoryId] = el;
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
                      e.preventDefault();
                      move(i, e.key === 'ArrowUp' ? i - 1 : i + 1);
                      requestAnimationFrame(() => handleRefs.current[r.categoryId]?.focus());
                    }}
                  >
                    <Icon name="drag" size="18px" />
                  </button>
                  <input
                    className={styles.nameInput}
                    aria-label="카테고리 이름"
                    value={r.name}
                    onChange={(e) => setRows((list) => list.map((x) => (x.categoryId === r.categoryId ? { ...x, name: e.target.value } : x)))}
                  />
                </>
              )}
              <span className={styles.count}>작품 {countOf(r.categoryId)}</span>
              {r.fixed ? (
                <span className={styles.count}>고정</span>
              ) : (
                <button type="button" className={styles.delete} onClick={() => setConfirmId(r.categoryId)} disabled={busy}>
                  <Icon name="trash" size="sm" />
                  삭제
                </button>
              )}
            </div>
            {confirmId === r.categoryId ? (
              <div className={styles.confirm} role="alert">
                <span>
                  「{r.original}」 삭제 · 이 카테고리의 작품 {countOf(r.categoryId)}개는 미분류로 옮겨짐
                </span>
                <span className={styles.confirmBtns}>
                  <Button size="sm" variant="secondary" onClick={() => setConfirmId(null)} disabled={busy}>
                    취소
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => remove(r.categoryId)} loading={busy}>
                    삭제
                  </Button>
                </span>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      <div className={styles.addRow}>
        <label htmlFor="new-category" className="sr-only">
          새 카테고리 이름
        </label>
        <input
          id="new-category"
          className={styles.addInput}
          placeholder="새 카테고리 이름"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button variant="secondary" size="lg" onClick={add} disabled={busy}>
          + 추가
        </Button>
      </div>
      <InlineError error={error} />
    </Modal>
  );
}
