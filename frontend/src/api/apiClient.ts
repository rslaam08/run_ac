import axios from 'axios';

const isProd = process.env.NODE_ENV === 'production';
const PROD_API_BASE = 'https://sshsrun-api.onrender.com';
const DEV_API_BASE  = 'http://localhost:4000';
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
  status:    () => api.get('/event/status', { headers: { 'Cache-Control': 'no-cache' } }),
  bet:       (amount: number) => api.post('/event/bet', { amount }, { headers: { 'Cache-Control': 'no-cache' } }),
  logs:      (slotId: string) => api.get(`/event/logs/${slotId}`, { headers: { 'Cache-Control': 'no-cache' } }),
  allLogs:   () => api.get('/event/logs/all', { headers: { 'Cache-Control': 'no-cache' } }),
  latest:    () => api.get('/event/logs/latest', { headers: { 'Cache-Control': 'no-cache' } }), // ✅ 추가
  market:    () => api.get('/event/market', { headers: { 'Cache-Control': 'no-cache' } }),
  buy:       (itemId: string) => api.post('/event/market/buy', { itemId }, { headers: { 'Cache-Control': 'no-cache' } }),
  purchases: () => api.get('/event/market/purchases', { headers: { 'Cache-Control': 'no-cache' } }),
};

// ===== 토큰 보관/주입 헬퍼 =====
const TOKEN_KEY = 'runac_jwt';

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
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

// 요청 인터셉터: Authorization 자동 첨부
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
