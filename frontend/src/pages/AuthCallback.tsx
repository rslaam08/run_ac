// frontend/src/pages/AuthCallback.tsx
import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // HashRouter에서는 "/#/auth/callback?token=..." 의 ?token=... 이 location.search 로 들어옵니다.
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    const error = params.get('error');

    if (token) {
      try {
        localStorage.setItem('authToken', token);
      } catch {}
      navigate('/', { replace: true });
    } else {
      alert(`로그인 실패${error ? `: ${error}` : ''}`);
      navigate('/', { replace: true });
    }
  }, [location.search, navigate]);

  return <div style={{ padding: '1rem' }}>로그인 처리 중…</div>;
};

export default AuthCallback;
