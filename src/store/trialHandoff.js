// 준비 화면에서 받은 재판 시작 응답을 재판 화면으로 한 번 넘기는 메모리 보관소.
// sessionStorage · localStorage · URL 에 두지 않는다 → 새로고침하면 사라지고 그 판은 이어갈 수 없다(재판 이탈 정책).
let pending = null;

export function putTrialHandoff(value) {
  pending = value;
}

export function peekTrialHandoff(caseId) {
  return pending && String(pending.caseId) === String(caseId) ? pending : null;
}

export function clearTrialHandoff(liveTrialId) {
  if (!liveTrialId || pending?.start?.trialId === liveTrialId) pending = null;
}
