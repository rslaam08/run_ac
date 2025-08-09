import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthCallback: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // HashRouter 사용 시: URL 예) .../#/auth/callback?token=XXX
    // 1) 해시 전체 가져오기
    const hash = window.location.hash || '';
    //    "#/auth/callback?token=..." 형태 → '?' 기준으로 split
    const [, queryString = ''] = hash.split('?');
    // 2) 해시 뒤의 쿼리스트링에서 token 추출
    const params = new URLSearchParams(queryString);
    const token = params.get('token');

    if (token) {
      try {
        localStorage.setItem('authToken', token);
      } catch {}
      // 홈으로 이동 (필요 시 이전 경로로 복귀 로직 추가 가능)
      navigate('/', { replace: true });
    } else {
      // 혹시 쿼리가 search 쪽에 온 경우(예외 대비)
      const params2 = new URLSearchParams(window.location.search);
      const token2 = params2.get('token');
      if (token2) {
        try {
          localStorage.setItem('authToken', token2);
        } catch {}
        navigate('/', { replace: true });
      } else {
        alert('로그인 토큰이 없습니다. 다시 시도해주세요.');
        navigate('/', { replace: true });
      }
    }
  }, [navigate]);

  return <div>로그인 처리 중…</div>;
};

export default AuthCallback;
