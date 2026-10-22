import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import Logo from '../components/Logo';
import Tabs from '../components/Tabs';
import Field, { Input } from '../components/Field';
import Button from '../components/Button';
import { InlineError } from '../components/States';
import { login, signupUser } from '../api/auth';
import { useAuth } from '../store/auth';
import { queryClient } from '../queryClient';
import { isBlank } from '../lib/text';
import styles from './AuthPage.module.css';

const POINTS = ['변호인 또는 검사 역할 선택', '모두 진술 → 근거 카드 공방 → 최후 변론', 'AI 판사의 판결과 형량'];

export default function AuthPage() {
  const token = useAuth((s) => s.token);
  const saveLogin = useAuth((s) => s.login);
  const location = useLocation();
  const navigate = useNavigate();
  const [mode, setMode] = useState(location.state?.mode === 'signup' ? 'signup' : 'login');
  const [form, setForm] = useState({ username: '', password: '', confirm: '', nickname: '' });
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);
  const authNotice = useAuth((s) => s.notice);
  const notice = location.state?.notice ?? authNotice;
  const from = location.state?.from;

  if (token) return <Navigate to={from || '/works'} replace />;

  const signup = mode === 'signup';
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const mismatch = signup && form.confirm.length > 0 && form.confirm !== form.password;

  const switchMode = (next) => {
    setMode(next);
    setError(null);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (pending) return;
    setError(null);
    // 서버 검증: 세 값 필수(공백만 불가) · 아이디 중복. 형식 · 길이 제한은 서버에 없다.
    if (isBlank(form.username) || form.password.length === 0 || (signup && isBlank(form.nickname))) {
      setError({ message: signup ? '아이디 · 비밀번호 · 닉네임을 입력해 주세요.' : '아이디와 비밀번호를 입력해 주세요.' });
      return;
    }
    if (signup && form.confirm !== form.password) {
      setError({ message: '비밀번호 확인이 일치하지 않습니다.' });
      return;
    }
    setPending(true);
    try {
      if (signup) await signupUser({ username: form.username, password: form.password, nickname: form.nickname });
      // 가입은 username 을 trim 해서 저장하므로 로그인도 같은 값으로 보낸다.
      const result = await login(signup ? form.username.trim() : form.username, form.password);
      queryClient.clear();
      saveLogin(result);
      navigate(from || '/works', { replace: true });
    } catch (err) {
      setError(err);
      setPending(false);
    }
  };

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <section className={styles.intro}>
          <div className={styles.introTop}>
            <Logo size="auth" />
            <h1 className={styles.headline}>
              작품 속 인물을
              <br />
              직접 변호하고
              <br />
              직접 기소하는 법정
            </h1>
            <p className={styles.lead}>영화·소설·만화·게임 속 문제적 선택을 다루는 AI 재판 · 판사를 설득하면 AI 판사가 판결과 형량 결정</p>
          </div>
          <ol className={styles.points}>
            {POINTS.map((text, i) => (
              <li key={text}>
                <span className={styles.num} aria-hidden="true">
                  {i + 1}
                </span>
                <span>{text}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.formSide}>
          <Tabs
            label="로그인 또는 회원가입"
            variant="auth"
            value={mode}
            onChange={switchMode}
            items={[
              { value: 'login', label: '로그인' },
              { value: 'signup', label: '회원가입' },
            ]}
          />
          {notice && !error ? (
            <div className={styles.notice} role="status">
              {notice}
            </div>
          ) : null}
          <form className={styles.form} onSubmit={onSubmit} noValidate>
            <Field label="아이디">
              {({ id }) => <Input id={id} size="lg" autoComplete="username" placeholder="영문, 숫자 4~20자" value={form.username} onChange={set('username')} />}
            </Field>
            <Field label="비밀번호">
              {({ id }) => <Input id={id} size="lg" type="password" autoComplete={signup ? 'new-password' : 'current-password'} placeholder="8자 이상" value={form.password} onChange={set('password')} />}
            </Field>
            {signup ? (
              <>
                <Field label="비밀번호 확인" error={mismatch ? '비밀번호 불일치' : null}>
                  {({ id, describedBy, invalid }) => (
                    <Input id={id} size="lg" type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} aria-describedby={describedBy} invalid={invalid} />
                  )}
                </Field>
                <Field label="닉네임">
                  {({ id, describedBy }) => <Input id={id} size="lg" placeholder="재판 기록에 보이는 이름" value={form.nickname} onChange={set('nickname')} aria-describedby={describedBy} />}
                </Field>
              </>
            ) : null}
            <InlineError error={error} />
            <Button type="submit" size="cta" block loading={pending}>
              {signup ? '가입하고 시작하기' : '로그인'}
            </Button>
          </form>
          <div className={styles.switch}>
            {signup ? '계정 보유 시' : '계정이 없을 때'}{' '}
            <button type="button" className={styles.switchBtn} onClick={() => switchMode(signup ? 'login' : 'signup')}>
              {signup ? '로그인' : '회원가입'}
            </button>
          </div>
          <div className={styles.foot}>
            관리자도 같은 화면에서 로그인 · 관리자 계정은 슈퍼 어드민이 생성
            <br />
            수업 과제·포트폴리오용 비영리 프로젝트 · <Link to="/credits">저작권 · 크레딧</Link>
          </div>
        </section>
      </div>
    </div>
  );
}
