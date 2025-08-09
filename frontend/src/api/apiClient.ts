// frontend/src/api/apiClient.ts
import axios from 'axios';

/**
 * 프로덕션(배포)에서는 같은 오리진(same-origin)에서 서빙된다고 가정.
 *  - 예: https://yourdomain.com  에서 프론트/백엔드 모두 동작
 *  -> baseURL을 ''로 두고, /api, /auth 같은 상대 경로로 호출.
 *
 * 로컬 개발에서는 백엔드가 4000 포트에서 뜬다고 가정.
 */
const base =
  process.env.NODE_ENV === 'production'
    ? ''                       // same-origin
    : 'http://localhost:4000'; // local dev

export const api = axios.create({
  baseURL: `${base}/api`,
  withCredentials: true,
  headers: { 'X-Requested-With': 'XMLHttpRequest' },
});

export const authApi = axios.create({
  baseURL: `${base}/auth`,
  withCredentials: true,
  headers: { 'X-Requested-With': 'XMLHttpRequest' },
});
