// frontend/src/api/apiClient.ts
import axios from 'axios';

// 프로덕션(배포): 같은 오리진 사용 → base = ''  (즉, /api, /auth 로 바로 호출)
// 로컬 개발: http://localhost:4000 사용
const base =
  process.env.NODE_ENV === 'production'
    ? ''
    : 'http://localhost:4000';

export const api = axios.create({
  baseURL: `${base}/api`,
  withCredentials: true,
});

export const authApi = axios.create({
  baseURL: `${base}/auth`,
  withCredentials: true,
});
