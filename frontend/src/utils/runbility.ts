// frontend/src/utils/runbility.ts

import runbilityData from '../data/runbility.json';

interface RunData {
  paces: number[];     // 각 칸의 페이스: 초 단위 (초/km)
  distances: number[]; // 각 칸의 거리: 미터 단위
  values: number[][];  // runbility 그리드 값
}
const raw = runbilityData as RunData;

// 원본 배열
const pacesSec = raw.paces;
const distancesM = raw.distances;
const values = raw.values;

// 오름차순 보간을 위한 인덱스 매핑
const paceIdx = pacesSec.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p);
const distIdx = distancesM.map((d, i) => ({ d, i })).sort((a, b) => a.d - b.d);

const sortedPaces = paceIdx.map(x => x.p);
const sortedDistancesM = distIdx.map(x => x.d);

// 범용 이분 탐색 + 보간 계수
function findBounds(arr: number[], v: number): [number, number, number] {
  const n = arr.length;
  if (v <= arr[0])     return [0, 0, 0];
  if (v >= arr[n - 1]) return [n - 1, n - 1, 0];
  let lo = 0, hi = n - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid] === v) return [mid, mid, 0];
    if (arr[mid] < v) lo = mid;
    else hi = mid;
  }
  const frac = (v - arr[lo]) / (arr[hi] - arr[lo]);
  return [lo, hi, frac];
}

/**
 * totalTimeSec: 전체 달리기 시간(초)
 * distanceKm: 달린 거리(킬로미터)
 * 페이스 = totalTimeSec / distanceKm (초/km)
 * 본 함수는 bilinear 보간으로 runbility를 반환
 */
export function getRunbility(totalTimeSec: number, distanceKm: number): number {
  // 1) 페이스 계산 (초/km)
  const paceSec = totalTimeSec / distanceKm;
  // 2) 거리 변환 (km → m)
  const distanceM = distanceKm * 1000;

  // 3) 보간용 인덱스, 비율
  const [pi0, pi1, pt] = findBounds(sortedPaces, paceSec);
  const [di0, di1, dt] = findBounds(sortedDistancesM, distanceM);

  // 4) 원본 그리드 인덱스 추출
  const col0 = paceIdx[pi0].i;
  const col1 = paceIdx[pi1].i;
  const row0 = distIdx[di0].i;
  const row1 = distIdx[di1].i;

  // 5) 네 점 값
  const Q00 = values[row0][col0];
  const Q10 = values[row0][col1];
  const Q01 = values[row1][col0];
  const Q11 = values[row1][col1];

  // 6) 정확 일치, 축보간, 전체 보간
  if (pt === 0 && dt === 0) {
    return Q00;
  } else if (pt === 0) {
    // 페이스는 정확, 거리만 보간
    return Q00 * (1 - dt) + Q01 * dt;
  } else if (dt === 0) {
    // 거리는 정확, 페이스만 보간
    return Q00 * (1 - pt) + Q10 * pt;
  } else {
    // bilinear 보간
    const R0 = Q00 * (1 - pt) + Q10 * pt;
    const R1 = Q01 * (1 - pt) + Q11 * pt;
    return R0 * (1 - dt) + R1 * dt;
  }
}
