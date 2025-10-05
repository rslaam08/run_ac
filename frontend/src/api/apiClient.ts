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
  // JWT를 Authorization 헤더로 보내므로 withCredentials 불필요
  withCredentials: false,
});

export const authApi = axios.create({
  baseURL: `${base}/auth`,
  withCredentials: false,
});
export const eventApi = {
  status:    () => api.get('/event/status'),
  bet:       (amount: number) => api.post('/event/bet', { amount }),
  resolve:   () => api.post('/event/resolve'),
  logs:      (slotId: string) => api.get(`/event/logs/${slotId}`),
  market:    () => api.get('/event/market'),
  buy:       (itemId: string) => api.post('/event/market/buy', { itemId }),
  purchases: () => api.get('/event/market/purchases'), // admin only
};


// ===== 토큰 보관/주입 헬퍼 =====
const TOKEN_KEY = 'runac_jwt';

export function getAuthToken(): string | null {
  const t = localStorage.getItem(TOKEN_KEY);
  console.debug('[apiClient] getAuthToken()', t ? `len=${t.length}` : 'null');
  return t;
}

export function setAuthToken(token: string) {
  console.debug('[apiClient] setAuthToken(len=', token?.length, ')');
  localStorage.setItem(TOKEN_KEY, token);
  api.defaults.headers.common.Authorization = `Bearer ${token}`;
  authApi.defaults.headers.common.Authorization = `Bearer ${token}`;
}

export function clearAuthToken() {
  console.debug('[apiClient] clearAuthToken()');
  localStorage.removeItem(TOKEN_KEY);
  delete api.defaults.headers.common.Authorization;
  delete authApi.defaults.headers.common.Authorization;
}


// 요청 인터셉터: Authorization 자동 첨부 + 로깅
api.interceptors.request.use((cfg) => {
  const t = getAuthToken();
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  console.debug('[api] →', cfg.method?.toUpperCase(), cfg.url, { hasAuth: !!t });
  return cfg;
});
authApi.interceptors.request.use((cfg) => {
  const t = getAuthToken();
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  console.debug('[authApi] →', cfg.method?.toUpperCase(), cfg.url, { hasAuth: !!t });
  return cfg;
});

// 응답 로깅
api.interceptors.response.use(
  (res) => {
    console.debug('[api] ←', res.status, res.config.url);
    return res;
  },
  (err) => {
    console.warn('[api] ✖', err?.response?.status, err?.config?.url, err?.response?.data);
    throw err;
  }
);
authApi.interceptors.response.use(
  (res) => {
    console.debug('[authApi] ←', res.status, res.config.url);
    return res;
  },
  (err) => {
    console.warn('[authApi] ✖', err?.response?.status, err?.config?.url, err?.response?.data);
    throw err;
  }
);

// 앱 시작 시 저장된 토큰을 기본 헤더에 반영
const bootToken = getAuthToken();
if (bootToken) {
  api.defaults.headers.common.Authorization = `Bearer ${bootToken}`;
  authApi.defaults.headers.common.Authorization = `Bearer ${bootToken}`;
  console.debug('[apiClient] boot with token');
}
