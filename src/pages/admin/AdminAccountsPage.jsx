import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Page } from '../../components/Layout';
import Button from '../../components/Button';
import Field, { Input } from '../../components/Field';
import Modal from '../../components/Modal';
import { Badge } from '../../components/RoleBadge';
import { ErrorState, InlineError, Loading } from '../../components/States';
import { deactivateAdmin, fetchAdmins, signupAdmin } from '../../api/auth';
import { isBlank } from '../../lib/text';
import styles from './AdminAccountsPage.module.css';

const EMPTY = { username: '', password: '', nickname: '' };

export default function AdminAccountsPage() {
  const qc = useQueryClient();
  const admins = useQuery({ queryKey: ['admins'], queryFn: fetchAdmins });
  const [form, setForm] = useState(EMPTY);
  const [createError, setCreateError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(null);
  const [ask, setAsk] = useState(null);
  const [askError, setAskError] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const create = async (e) => {
    e.preventDefault();
    if (creating) return;
    setCreated(null);
    // 서버 검증: 세 값 필수(공백만 불가) · 아이디 중복(삭제된 계정 포함). 길이 · 형식 제한은 서버에 없다.
    if (isBlank(form.username) || form.password.length === 0 || isBlank(form.nickname)) {
      setCreateError({ message: '아이디 · 비밀번호 · 닉네임을 입력해 주세요.' });
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      await signupAdmin(form);
      setCreated(form.username.trim());
      setForm(EMPTY);
      qc.invalidateQueries({ queryKey: ['admins'] });
    } catch (err) {
      setCreateError(err);
    } finally {
      setCreating(false);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    setAskError(null);
    try {
      await deactivateAdmin(ask.id); // 목록의 id 로 요청 (행 번호 · username 아님)
      setAsk(null);
      qc.invalidateQueries({ queryKey: ['admins'] });
    } catch (err) {
      setAskError(err);
    } finally {
      setDeleting(false);
    }
  };

  const list = admins.data ?? [];
  const dup = createError?.businessCode === 'USERNAME_ALREADY_EXISTS';

  return (
    <Page width="wide" gap="md">
      <div className={styles.head}>
        <h1 className={styles.h1}>관리자 계정 관리</h1>
      </div>

      <form className={styles.section} onSubmit={create} noValidate>
        <h2 className={styles.h2}>새 관리자 만들기</h2>
        <div className={styles.grid}>
          <Field label="아이디" error={dup ? '이미 사용 중인 아이디 · 유저·관리자·삭제된 계정 전체 기준 확인' : null}>
            {({ id, describedBy, invalid }) => <Input id={id} autoComplete="off" value={form.username} onChange={set('username')} aria-describedby={describedBy} invalid={invalid} />}
          </Field>
          <Field label="비밀번호">{({ id }) => <Input id={id} type="password" autoComplete="new-password" value={form.password} onChange={set('password')} />}</Field>
          <Field label="닉네임">{({ id }) => <Input id={id} autoComplete="off" value={form.nickname} onChange={set('nickname')} />}</Field>
        </div>
        {!dup ? <InlineError error={createError} /> : null}
        <div className={styles.formFoot}>
          {created ? (
            <span className={styles.ok} role="status">
              {created} 관리자 계정 생성 완료
            </span>
          ) : (
            <span />
          )}
          <Button type="submit" loading={creating}>
            관리자 만들기
          </Button>
        </div>
      </form>

      <section className={styles.listSection}>
        <div className={styles.listHead}>
          <h2 className={styles.h2Big}>관리자 목록</h2>
          <span className={styles.count}>{list.length}명</span>
        </div>
        {admins.isPending ? <Loading /> : null}
        {admins.isError ? <ErrorState error={admins.error} onRetry={() => admins.refetch()} /> : null}
        {admins.isSuccess ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">아이디</th>
                  <th scope="col">닉네임</th>
                  <th scope="col">권한</th>
                  <th scope="col" className={styles.right}>
                    관리
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.map((a) => {
                  const sup = a.authority === 'SUPER_ADMIN';
                  return (
                    <tr key={a.id} className={a.usage ? undefined : styles.inactive}>
                      <td>{a.username}</td>
                      <td className={styles.nick}>{a.nickname}</td>
                      <td>
                        <Badge tone="admin" icon="admin">
                          {sup ? '슈퍼 관리자' : '관리자'}
                        </Badge>
                        {!a.usage ? (
                          <span className={styles.off}>
                            {' '}
                            <Badge tone="neutral" icon="lock">
                              비활성
                            </Badge>
                          </span>
                        ) : null}
                      </td>
                      <td className={styles.right}>
                        {sup ? (
                          <span className={styles.muted}>삭제 불가</span>
                        ) : (
                          <Button variant="dangerOutline" size="sm" disabled={!a.usage} onClick={() => setAsk(a)} aria-label={`${a.username} 계정 삭제`}>
                            {a.usage ? '삭제' : '삭제됨'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <Modal
        open={!!ask}
        tone="danger"
        title={`${ask?.username ?? ''} 계정 삭제`}
        onClose={() => !deleting && (setAsk(null), setAskError(null))}
        busy={deleting}
        width={400}
        actions={
          <>
            <Button variant="secondary" onClick={() => setAsk(null)} disabled={deleting} data-autofocus>
              취소
            </Button>
            <Button variant="danger" onClick={confirmDelete} loading={deleting}>
              삭제
            </Button>
          </>
        }
      >
        <div className={styles.modalBody}>삭제한 계정은 복구 불가 · 이 아이디는 다시 쓸 수 없음 · 이 관리자가 만든 작품과 사건은 유지</div>
        <div className={styles.muted}>계정은 비활성화되어 로그인할 수 없음 · 이미 로그인한 화면은 토큰 만료(최대 1시간) 전까지 동작할 수 있음</div>
        <InlineError error={askError} />
      </Modal>
    </Page>
  );
}
