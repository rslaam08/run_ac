// KST로 "지금"과 슬롯 계산, 러닝빌리티 함수, 이벤트 기간 체크

export const KST_OFFSET = 9 * 60; // minutes

function toKST(date = new Date()) {
  const utc = date.getTime() + date.getTimezoneOffset()*60000;
  return new Date(utc + KST_OFFSET*60000);
}

export function isWithinEvent(date = new Date()) {
  const kst = toKST(date);
  const start = new Date('2025-10-06T00:00:00+09:00');
  const end   = new Date('2025-10-12T23:59:59+09:00');
  return kst >= start && kst <= end;
}

export function getEventSlotId(date = new Date()) {
  // 10분 슬롯. 예) 20251006-21:10 → "20251006-21-10"
  const kst = toKST(date);
  const y = kst.getFullYear();
  const m = String(kst.getMonth()+1).padStart(2,'0');
  const d = String(kst.getDate()).padStart(2,'0');
  const H = String(kst.getHours()).padStart(2,'0');
  const mm= kst.getMinutes();
  const slotMin = Math.floor(mm/10)*10; // 0,10,20...
  return `${y}${m}${d}-${H}-${String(slotMin).padStart(2,'0')}`;
}

export function isBettingWindow(date = new Date()) {
  // 21:01~23:59 중 (:01~:09)만 베팅 허용
  const kst = toKST(date);
  const h = kst.getHours();
  const m = kst.getMinutes();
  if (h < 21 || h > 23) return false;
  const mod = m % 10;
  return mod >= 1 && mod <= 9;
}

export function resultTimeOfCurrentSlot(date = new Date()) {
  // 현재 시각 기준 결과 발표 시각(:10, :20, ...)
  const kst = toKST(date);
  const base = new Date(kst);
  const slotMin = Math.ceil((kst.getMinutes()+1)/10)*10; // 다음 10분 경계
  base.setMinutes(slotMin, 0, 0);
  return base;
}

// 프런트와 동일한 runbility 계산 (현재 사용 중인 공식으로 교체)
export function getRunbility(timeSec: number, distanceKm: number) {
  // 예시(사용중인 util과 동일하게 맞춰야 함):
  const pace = timeSec / (distanceKm || 1); // sec/km
  // ... 실제 사이트에서 쓰는 공식을 그대로 옮겨오세요.
  // 여기선 placeholder:
  return Math.max(0, 10000 - pace);
}

// 보름달 코인 합성 공식
export function mergeMoon(oldMoon: number, runbility: number) {
  // ( old^1.5 + run^1.5 )^(2/3)
  const a = Math.pow(Math.max(0, oldMoon), 1.5);
  const b = Math.pow(Math.max(0, runbility), 1.5);
  return Math.pow(a + b, 2/3);
}
