import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const hash = location.hash || '';
    const query = hash.includes('?') ? hash.split('?')[1] : '';
    const params = new URLSearchParams(query);
    const token = params.get('token');
    const error = params.get('error');

    if (token) {
      localStorage.setItem('authToken', token);
      navigate('/', { replace: true });
    } else {
      alert(`로그인 실패${error ? `: ${error}` : ''}`);
      navigate('/', { replace: true });
    }
  }, [location.hash, navigate]);

  return <div style={{ padding: '1rem' }}>로그인 처리 중…</div>;
};

export default AuthCallback;
