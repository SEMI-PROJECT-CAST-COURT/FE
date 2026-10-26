import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Page } from '../../components/Layout';
import Button from '../../components/Button';
import Field, { Input, Select, TextArea } from '../../components/Field';
import Icon from '../../components/Icon';
import Poster from '../../components/Poster';
import { ErrorState, InlineError, Loading } from '../../components/States';
import { fetchCategories } from '../../api/categories';
import { createWork, draftWorkSummary, fetchWork, updateWork } from '../../api/works';
import { codePointLength, isBlank, strip, todayIso } from '../../lib/text';
import styles from './AdminWorkPage.module.css';

const POSTER_MAX = 500 * 1024; // 서버 PosterStorage · MultipartConfig 기준
const POSTER_TYPES = ['image/jpeg', 'image/png'];
const TEXT_MAX = 100; // 제목 · 원작자 · 소개 모두 codePoint 100자

function validate(form) {
  const errors = {};
  if (!form.categoryId) errors.categoryId = '카테고리를 골라 주세요.';
  if (isBlank(form.title)) errors.title = '제목을 입력해 주세요.';
  else if (codePointLength(strip(form.title)) > TEXT_MAX) errors.title = '제목은 100자 이하여야 합니다.';
  if (isBlank(form.author)) errors.author = '원작자를 입력해 주세요.';
  else if (codePointLength(strip(form.author)) > TEXT_MAX) errors.author = '원작자는 100자 이하여야 합니다.';
  if (!form.releasedOn) errors.releasedOn = '공개 일자를 입력해 주세요.';
  if (codePointLength(form.summary) > TEXT_MAX) errors.summary = '작품 소개는 100자 이하여야 합니다.';
  return errors;
}

export default function AdminWorkPage() {
  const { workId } = useParams();
  const edit = !!workId;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const categories = useQuery({ queryKey: ['categories'], queryFn: fetchCategories });
  const work = useQuery({ queryKey: ['work', workId], queryFn: () => fetchWork(workId), enabled: edit });
  const [form, setForm] = useState(null);
  const [poster, setPoster] = useState(null); // { file, url }
  const [posterError, setPosterError] = useState(null);
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState(null);
  const fileRef = useRef(null);

  // 초기값: 등록은 빈 값, 수정은 상세 응답. 상세의 category 는 이름이라 카테고리 목록에서 id 를 찾는다.
  if (!form && categories.data && (!edit || work.data)) {
    if (edit) {
      const w = work.data;
      const found = categories.data.find((c) => c.name === w.category);
      setForm({ categoryId: found ? String(found.categoryId) : '', title: w.title, author: w.author, releasedOn: w.releasedOn ?? '', summary: w.summary ?? '', missingCategory: !found });
    } else {
      setForm({ categoryId: '', title: '', author: '', releasedOn: todayIso(), summary: '' });
    }
  }

  useEffect(() => () => poster?.url && URL.revokeObjectURL(poster.url), [poster]);

  if (categories.isPending || (edit && work.isPending)) return <Page width="wide"><Loading /></Page>;
  if (categories.isError) return <Page width="wide"><ErrorState error={categories.error} onRetry={() => categories.refetch()} /></Page>;
  if (edit && work.isError) return <Page width="wide"><ErrorState error={work.error} /></Page>;
  if (!form) return <Page width="wide"><Loading /></Page>;

  const set = (key) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((er) => ({ ...er, [key]: undefined }));
  };

  const pickPoster = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!POSTER_TYPES.includes(file.type) && !/\.(jpe?g|png)$/i.test(file.name)) {
      setPosterError('포스터는 JPG 또는 PNG만 등록할 수 있습니다.');
      return;
    }
    if (file.size > POSTER_MAX) {
      setPosterError(`포스터는 ${POSTER_MAX / 1024}KB 이하여야 합니다. (선택한 파일 ${Math.ceil(file.size / 1024)}KB)`);
      return;
    }
    setPosterError(null);
    setPoster({ file, url: URL.createObjectURL(file) });
  };

  const draft = async () => {
    if (drafting) return;
    if (isBlank(form.title) || isBlank(form.author)) {
      setDraftError({ message: '작품 제목과 원작자를 먼저 입력해 주세요.' });
      return;
    }
    setDrafting(true);
    setDraftError(null);
    try {
      const { summary } = await draftWorkSummary(strip(form.title), strip(form.author));
      // 초안은 summary 입력값일 뿐 저장이 아니다. 실패하면 사용자가 적은 값을 지우지 않는다.
      setForm((f) => ({ ...f, summary }));
    } catch (err) {
      setDraftError(err);
    } finally {
      setDrafting(false);
    }
  };

  const save = async () => {
    if (saving) return;
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    setSaveError(null);
    const body = {
      categoryId: Number(form.categoryId),
      title: strip(form.title),
      author: strip(form.author),
      releasedOn: form.releasedOn,
      summary: form.summary === '' ? null : form.summary,
    };
    try {
      if (edit) {
        await updateWork(workId, body, poster?.file);
        qc.invalidateQueries({ queryKey: ['work', workId] });
        qc.invalidateQueries({ queryKey: ['works'] });
        qc.invalidateQueries({ queryKey: ['allWorks'] });
        navigate(`/works/${workId}`);
      } else {
        const { workId: newId } = await createWork(body, poster?.file);
        qc.invalidateQueries({ queryKey: ['works'] });
        qc.invalidateQueries({ queryKey: ['allWorks'] });
        navigate(`/works/${newId}`);
      }
    } catch (err) {
      setSaveError(err);
      setSaving(false);
    }
  };

  const back = edit ? `/works/${workId}` : '/works';
  const summaryLen = codePointLength(form.summary);

  return (
    <Page width="wide" gap="md" className={styles.page}>
      <Link to={back} className={styles.back}>
        ← {edit ? work.data.title : '작품 목록'}
      </Link>
      <div className={styles.head}>
        <h1 className={styles.h1}>{edit ? '작품 수정' : '새 작품 등록'}</h1>
      </div>

      <section className={styles.card}>
        <div className={styles.posterCol}>
          <span className={styles.label}>포스터</span>
          <button type="button" className={`${styles.posterBox} ${poster || edit ? styles.hasImage : ''}`} onClick={() => fileRef.current?.click()} aria-label="포스터 올리기">
            {poster ? (
              <>
                <img src={poster.url} alt="올릴 포스터 미리보기" className={styles.preview} />
                <span className={styles.overlay}>업로드 전 미리보기 · 클릭해서 바꾸기</span>
              </>
            ) : edit ? (
              <>
                <Poster src={work.data.posterUrl} alt={work.data.title} />
                <span className={styles.overlay}>현재 포스터 · 클릭해서 바꾸기</span>
              </>
            ) : (
              <>
                <Icon name="upload" size="28px" />
                <span className={styles.posterText}>클릭해서 포스터 올리기</span>
              </>
            )}
          </button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png" className="sr-only" tabIndex={-1} onChange={pickPoster} />
          {posterError ? (
            <span className={styles.error} role="alert">
              {posterError}
            </span>
          ) : null}
        </div>

        <div className={styles.fields}>
          <div className={styles.grid}>
            <Field label="카테고리" error={errors.categoryId || (form.missingCategory && !form.categoryId ? '기존 카테고리를 찾지 못함 · 다시 골라 주세요' : null)}>
              {({ id, describedBy, invalid }) => (
                <Select id={id} value={form.categoryId} onChange={set('categoryId')} aria-describedby={describedBy} invalid={invalid}>
                  <option value="">카테고리 선택</option>
                  {categories.data.map((c) => (
                    <option key={c.categoryId} value={c.categoryId}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="제목" error={errors.title}>
              {({ id, describedBy, invalid }) => <Input id={id} value={form.title} onChange={set('title')} aria-describedby={describedBy} invalid={invalid} />}
            </Field>
            <Field label="원작자 (개발사)" error={errors.author}>
              {({ id, describedBy, invalid }) => <Input id={id} value={form.author} onChange={set('author')} aria-describedby={describedBy} invalid={invalid} />}
            </Field>
            <Field label="공개 일자" error={errors.releasedOn}>
              {({ id, describedBy, invalid }) => <Input id={id} type="date" value={form.releasedOn} onChange={set('releasedOn')} aria-describedby={describedBy} invalid={invalid} />}
            </Field>
          </div>
          <div className={styles.summaryField}>
            <div className={styles.summaryHead}>
              <label htmlFor="work-summary" className={styles.label}>
                작품 소개 (짧은 줄거리 · 선택)
              </label>
              <Button variant="secondary" size="sm" onClick={draft} loading={drafting}>
                <Icon name="ai" size="sm" />
                {form.summary ? 'AI 초안 다시 받기' : 'AI 초안 받기'}
              </Button>
            </div>
            <TextArea id="work-summary" rows={4} value={form.summary} onChange={set('summary')} invalid={!!errors.summary || summaryLen > TEXT_MAX} aria-describedby="work-summary-hint" />
            <span id="work-summary-hint" className={styles.summaryHint}>
              <span className={summaryLen > TEXT_MAX ? styles.over : undefined}>{summaryLen} / 100자</span>
            </span>
            {errors.summary ? <span className={styles.error}>{errors.summary}</span> : null}
            {drafting ? (
              <span className={styles.posterNote} role="status">
                AI가 소개 초안을 쓰는 중
              </span>
            ) : null}
            <InlineError error={draftError} />
          </div>
        </div>
      </section>

      <InlineError error={saveError} />
      <div className={styles.actions}>
        <Button variant="secondary" size="xl" to={back}>
          취소
        </Button>
        <Button size="xl" onClick={save} loading={saving}>
          {edit ? '저장' : '등록'}
        </Button>
      </div>
    </Page>
  );
}
