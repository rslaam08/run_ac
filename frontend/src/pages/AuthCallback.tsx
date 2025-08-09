// frontend/src/pages/AuthCallback.tsx
import React, { useEffect, useState } from 'react';
import { setAuthToken } from '../api/apiClient';
import { useNavigate } from 'react-router-dom';

function extractToken(): string | null {
  // 1) 해시에서 token= 파라미터
  const hash = window.location.hash || '';
  const hashParams = new URLSearchParams(hash.slice(1)); // remove '#'
  let token = hashParams.get('token');

  // 2) 혹시 검색쿼리로 왔다면 거기서도 시도
  if (!token) {
    const qs = new URLSearchParams(window.location.search);
    token = qs.get('token');
  }
  return token;
}

const AuthCallback: React.FC = () => {
  const nav = useNavigate();
  const [debug, setDebug] = useState<{ found: boolean; saved: boolean; tokenLen: number }>(
    { found: false, saved: false, tokenLen: 0 }
  );

  useEffect(() => {
    console.debug('[AuthCallback] location', { hash: window.location.hash, search: window.location.search });

    const token = extractToken();
    if (!token) {
      console.warn('[AuthCallback] no token found in URL');
      setDebug({ found: false, saved: false, tokenLen: 0 });
      return;
    }

    try {
      setAuthToken(token);
      setDebug({ found: true, saved: true, tokenLen: token.length });
      console.debug('[AuthCallback] token saved. redirecting to / ...');

      // 잠깐 보여주고 홈으로
      const t = setTimeout(() => nav('/', { replace: true }), 600);
      return () => clearTimeout(t);
    } catch (e) {
      console.error('[AuthCallback] failed to save token', e);
      setDebug({ found: true, saved: false, tokenLen: token.length });
    }
  }, [nav]);

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Authenticating…</h2>
      <pre style={{ background:'#f6f8fa', padding:'1rem', borderRadius:8, overflowX:'auto' }}>
        {JSON.stringify(debug, null, 2)}
      </pre>
      <p>브라우저 콘솔(F12)에서도 네트워크/콘솔 로그를 확인해 주세요.</p>
      <button onClick={() => nav('/')}>홈으로</button>
    </div>
  );
};

export default AuthCallback;
