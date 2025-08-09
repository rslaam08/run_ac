// frontend/src/api/apiClient.ts
import axios from 'axios';

// 배포(깃허브 페이지)에서는 백엔드 고정 도메인으로 호출
// 로컬 개발 시에는 localhost:4000
const API_BASE =
  process.env.NODE_ENV === 'production'
    ? 'https://sshsrun-api.onrender.com'
    : 'http://localhost:4000';

export const api = axios.create({
  baseURL: `${API_BASE}/api`,
});

export const authApi = axios.create({
  baseURL: `${API_BASE}/auth`,
});

// JWT 토큰 자동 첨부 (localStorage에 저장된 토큰이 있으면 Authorization 헤더 추가)
const attachToken = (config: any) => {
  try {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {}
  return config;
};

api.interceptors.request.use(attachToken);
authApi.interceptors.request.use(attachToken);
