import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const AuthCallback: React.FC = () => {
  const nav = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(loc.search);
    const token = params.get('token');
    if (token) {
      localStorage.setItem('token', token);
      nav('/', { replace: true });
    } else {
      alert('로그인 토큰을 받지 못했습니다.');
      nav('/', { replace: true });
    }
  }, [loc, nav]);

  return <div>로그인 처리 중…</div>;
};

export default AuthCallback;
