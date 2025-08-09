import React, { useEffect, useState } from 'react';
import { setAuthToken } from '../api/apiClient';
import { useNavigate } from 'react-router-dom';

const AuthCallbackPage: React.FC = () => {
  const nav = useNavigate();
  const [debug, setDebug] = useState({ found: false, saved: false, tokenLen: 0 });

  useEffect(() => {
    // 1) #/auth/callback?token=...  (HashRouter 방식)
    const hash = window.location.hash.replace(/^#/, ''); // "auth/callback?token=..." 또는 "?token=..."
    const hashParams = new URLSearchParams(hash.includes('?') ? hash.split('?')[1] : hash);

    // 2) /auth/callback?token=...   (BrowserRouter/쿼리스트링)
    const searchParams = new URLSearchParams(window.location.search);

    const token =
      hashParams.get('token') ||
      searchParams.get('token') ||
      null;

    const found = !!token;
    let saved = false;

    if (token) {
      try {
        setAuthToken(token);
        saved = true;
      } catch {}
    }
    setDebug({ found, saved, tokenLen: token?.length || 0 });

    // 홈으로 이동
    const to = '/';
    setTimeout(() => nav(to, { replace: true }), 400);
  }, [nav]);

  return (
    <div style={{ padding: 24 }}>
      <h3>Authenticating…</h3>
      <pre>{JSON.stringify(debug, null, 2)}</pre>
      <p>브라우저 콘솔(F12)에서도 네트워크/콘솔 로그를 확인해 주세요.</p>
    </div>
  );
};

export default AuthCallbackPage;
