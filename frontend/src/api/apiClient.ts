// frontend/src/api/apiClient.ts
import axios from 'axios';

const isProd = process.env.NODE_ENV === 'production';

// 배포(깃허브 페이지): 백엔드(Render) 도메인
const PROD_API_BASE = 'https://sshsrun-api.onrender.com';
// 로컬 개발
const DEV_API_BASE = 'http://localhost:4000';

const base = isProd ? PROD_API_BASE : DEV_API_BASE;

export const api = axios.create({
  baseURL: `${base}/api`,
  withCredentials: false,
});

export const authApi = axios.create({
  baseURL: `${base}/auth`,
  withCredentials: false,
});

export const eventApi = {
  status:    () => api.get('/event/status'),
  bet:       (amount: number) => api.post('/event/bet', { amount }),
  logs:      (slotId: string) => api.get(`/event/logs/${slotId}`),
  logsAll:   () => api.get('/event/logs/all'),
  market:    () => api.get('/event/market'),
  buy:       (itemId: string) => api.post('/event/market/buy', { itemId }),
  purchases: () => api.get('/event/market/purchases'),
};

// ✅ 여기 추가되어 있어야 합니다
export const secretApi = {
  check: () => api.get('/secret/check'),
};

// ===== 토큰 헬퍼 =====
const TOKEN_KEY = 'runac_jwt';

export function getAuthToken(): string | null {
  const t = localStorage.getItem(TOKEN_KEY);
  return t;
}

export function setAuthToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
  api.defaults.headers.common.Authorization = `Bearer ${token}`;
  authApi.defaults.headers.common.Authorization = `Bearer ${token}`;
}

export function clearAuthToken() {
  localStorage.removeItem(TOKEN_KEY);
  delete api.defaults.headers.common.Authorization;
  delete authApi.defaults.headers.common.Authorization;
}

// 요청 인터셉터
api.interceptors.request.use((cfg) => {
  const t = getAuthToken();
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});
authApi.interceptors.request.use((cfg) => {
  const t = getAuthToken();
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

// 응답
api.interceptors.response.use(
  (res) => res,
  (err) => { throw err; }
);
authApi.interceptors.response.use(
  (res) => res,
  (err) => { throw err; }
);

// 부팅 시 토큰 반영
const bootToken = getAuthToken();
if (bootToken) {
  api.defaults.headers.common.Authorization = `Bearer ${bootToken}`;
  authApi.defaults.headers.common.Authorization = `Bearer ${bootToken}`;
}
