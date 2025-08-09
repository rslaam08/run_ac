import React, { useState, useEffect, FormEvent } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import './Layout.css';
import { api, authApi } from '../api/apiClient';

type SimpleUser = { seq: number; name: string };

const Header: React.FC = () => {
  const [loggedIn, setLoggedIn] = useState<boolean>(false);
  const [userSeq, setUserSeq]   = useState<number | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [searchBusy, setSearchBusy] = useState(false);

  const navigate = useNavigate();

  // 로그인 상태 확인: /auth/me (JWT로 확인)
  useEffect(() => {
    authApi.get('/me')
      .then(res => {
        setLoggedIn(true);
        setUserSeq(res.data.seq);
      })
      .catch(() => {
        setLoggedIn(false);
        setUserSeq(null);
      });
  }, []);

  // 로그인: 백엔드 도메인의 /auth/google 로, 리다이렉트 목적지 전달
  const handleLogin = () => {
    const redirect = `${window.location.origin}${window.location.pathname}#/auth/callback`;
    // 예: https://rslaam08.github.io/run_ac/#/auth/callback
    window.location.href =
      `https://sshsrun-api.onrender.com/auth/google?redirect=${encodeURIComponent(redirect)}`;
  };

  // 로그아웃: 토큰 제거 + (선택) 서버 세션 정리
  const handleLogout = () => {
    try { localStorage.removeItem('authToken'); } catch {}
    // 서버 세션도 함께 종료 시도 (실패해도 무시)
    authApi.post('/logout').finally(() => {
      setLoggedIn(false);
      setUserSeq(null);
      navigate('/', { replace: true });
    });
  };

  // 유저 검색: /api/user 전체를 받아서 클라이언트에서 매칭
  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    const q = searchTerm.trim();
    if (!q) return;

    try {
      setSearchBusy(true);
      const res = await api.get<SimpleUser[]>('/user');
      const users = res.data;

      // 1) 대소문자 무시 정확 일치
      const exact = users.find(u => u.name.toLowerCase() === q.toLowerCase());
      if (exact) return navigate(`/user/${exact.seq}`);

      // 2) 부분 일치
      const partial = users.find(u => u.name.toLowerCase().includes(q.toLowerCase()));
      if (partial) return navigate(`/user/${partial.seq}`);

      alert('해당 닉네임의 유저를 찾을 수 없습니다.');
    } catch (err) {
      console.error('Search failed:', err);
      alert('검색 중 오류가 발생했습니다.');
    } finally {
      setSearchBusy(false);
    }
  };

  return (
    <header className="header">
      <div className="header-content">
        <Link to="/" className="logo">run.ac</Link>

        <div className="right-wrap">
          {/* 버튼 그룹 */}
          <div className="button-group">
            <Link to="/ranking" className="nav-btn">랭킹</Link>

            {loggedIn ? (
              <button className="nav-btn" onClick={handleLogout}>로그아웃</button>
            ) : (
              <button className="nav-btn" onClick={handleLogin}>Google 로그인</button>
            )}

            <button
              className="nav-btn mypage-btn"
              onClick={() => {
                if (!userSeq) alert('로그인해주세요.');
                else navigate(`/user/${userSeq}`);
              }}
            >
              마이 페이지
            </button>

            {/* 계산기 탭 */}
            <Link to="/calc" className="nav-btn">runbility 계산기</Link>
          </div>

          {/* 유저 검색창 — 맨 오른쪽으로 */}
          <form className="user-search" onSubmit={handleSearch}>
            <input
              type="text"
              placeholder="유저 닉네임 검색"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={searchBusy}
            />
            <button type="submit" disabled={searchBusy}>
              {searchBusy ? '검색중…' : '검색'}
            </button>
          </form>
        </div>
      </div>
    </header>
  );
};

const Layout: React.FC = () => (
  <div className="layout">
    <Header />
    <main className="container">
      <Outlet />
    </main>
  </div>
);

export default Layout;
