import React, { useState, useEffect, FormEvent } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { api, authApi } from '../api/apiClient';
import './Layout.css';

type SimpleUser = { seq: number; name: string };

const SHOW_DEBUG = false; // ← 디버깅 배지/표시 끄기

// 현재 페이지가 GitHub Pages 하위 경로(/run_ac/)인지 감지해서 콜백 base 생성
function getFrontBase(): string {
  const path = window.location.pathname;
  const base = path.startsWith('/run_ac') ? '/run_ac/' : '/';
  return `${window.location.origin}${base}`;
}

const Header: React.FC = () => {
  const [loggedIn, setLoggedIn] = useState<boolean>(false);
  const [userSeq, setUserSeq]   = useState<number | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [searchBusy, setSearchBusy] = useState(false);

  const navigate = useNavigate();

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

  const handleLogin = () => {
    const authBase = String(authApi.defaults.baseURL || '').replace(/\/$/, '');
    const redirectBase = getFrontBase(); // ex) https://rslaam08.github.io/run_ac/
    window.location.href = `${authBase}/google?origin=${encodeURIComponent(redirectBase)}`;
  };

  const handleLogout = () => {
    authApi.post('/logout')
      .then(() => (window.location.href = getFrontBase()))
      .catch(err => console.error('Logout failed', err));
  };

  // 유저 검색: /api/user 전체 받아서 매칭
  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    const q = searchTerm.trim();
    if (!q) return;

    try {
      setSearchBusy(true);
      const res = await api.get<SimpleUser[]>('/user');
      const users = res.data;

      // 1) 정확히(대소문자 무시)
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

            <Link to="/calc" className="nav-btn">runbility 계산기</Link>
          </div>

          {/* 유저 검색창 — 맨 오른쪽 */}
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

          {/* 디버그 배지(임시 비표시) */}
          {SHOW_DEBUG && (
            <span className="debug-badge">DEBUG</span>
          )}
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
