// backend/src/utils/runbility.ts
import raw from '../data/runbility.json';

type RunData = {
  paces: number[];      // 초/㎞
  distances: number[];  // m
  values: number[][];   // [row=distance][col=pace]
};

// 0) 원본 로드
const data = raw as RunData;
const pacesSec = data.paces.slice();
const distancesM = data.distances.slice();
const values = data.values;

// 1) 정렬 인덱스 구성(원본 순서 보존용)
const paceIdx = pacesSec.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p);
const distIdx = distancesM.map((d, i) => ({ d, i })).sort((a, b) => a.d - b.d);

const sortedPaces = paceIdx.map(x => x.p);
const sortedDistancesM = distIdx.map(x => x.d);

// 2) 범위/보간 유틸 (이분 탐색)
function findBounds(arr: number[], v: number): [lo: number, hi: number, t: number] {
  const n = arr.length;
  if (v <= arr[0])     return [0, 0, 0];
  if (v >= arr[n - 1]) return [n - 1, n - 1, 0];

  let lo = 0, hi = n - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >>> 1;
    const mv = arr[mid];
    if (mv === v) return [mid, mid, 0];
    if (mv < v) lo = mid; else hi = mid;
  }
  const t = (v - arr[lo]) / (arr[hi] - arr[lo]);
  return [lo, hi, t];
}

/**
 * totalTimeSec: 전체 시간(초)
 * distanceKm  : 거리(킬로미터)
 * 반환값      : runbility 점수 (bilinear 보간)
 */
export function getRunbility(totalTimeSec: number, distanceKm: number): number {
  // 가드
  if (!Number.isFinite(totalTimeSec) || totalTimeSec <= 0) return 0;
  if (!Number.isFinite(distanceKm)   || distanceKm   <= 0) return 0;

  const paceSec = totalTimeSec / distanceKm;   // 초/㎞
  const distanceM = distanceKm * 1000;         // m

  // 보간 인덱스/계수
  const [pi0, pi1, pt] = findBounds(sortedPaces, paceSec);
  const [di0, di1, dt] = findBounds(sortedDistancesM, distanceM);

  // 원본 그리드 좌표로 매핑
  const col0 = paceIdx[pi0].i;
  const col1 = paceIdx[pi1].i;
  const row0 = distIdx[di0].i;
  const row1 = distIdx[di1].i;

  const Q00 = values[row0][col0];
  const Q10 = values[row0][col1];
  const Q01 = values[row1][col0];
  const Q11 = values[row1][col1];

  if (pt === 0 && dt === 0) {
    return Q00;
  } else if (pt === 0) {
    // 거리만 보간
    return Q00 * (1 - dt) + Q01 * dt;
  } else if (dt === 0) {
    // 페이스만 보간
    return Q00 * (1 - pt) + Q10 * pt;
  } else {
    // 이중선형 보간
    const R0 = Q00 * (1 - pt) + Q10 * pt;
    const R1 = Q01 * (1 - pt) + Q11 * pt;
    return R0 * (1 - dt) + R1 * dt;
  }
}
