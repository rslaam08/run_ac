import React, { useState, useEffect, FormEvent } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { api, authApi } from '../api/apiClient';
import './Layout.css';

type SimpleUser = { seq: number; name: string };
const SHOW_DEBUG = false;

function getFrontBase(): string {
  const path = window.location.pathname;
  const base = path.startsWith('/run_ac') ? '/run_ac/' : '/';
  return `${window.location.origin}${base}`;
}

const Header: React.FC = () => {
  const [loggedIn, setLoggedIn] = useState(false);
  const [userSeq, setUserSeq]   = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchBusy, setSearchBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    authApi.get('/me')
      .then(res => { setLoggedIn(true); setUserSeq(res.data.seq); })
      .catch(() => { setLoggedIn(false); setUserSeq(null); });
  }, []);

  const handleLogin = () => {
    const authBase = String(authApi.defaults.baseURL || '').replace(/\/$/, '');
    const redirectBase = getFrontBase();
    window.location.href = `${authBase}/google?origin=${encodeURIComponent(redirectBase)}`;
  };
  const handleLogout = () => {
    authApi.post('/logout').then(() => (window.location.href = getFrontBase()))
      .catch(err => console.error('Logout failed', err));
  };

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    const q = searchTerm.trim();
    if (!q) return;
    try {
      setSearchBusy(true);
      const res = await api.get<SimpleUser[]>('/user');
      const users = res.data;
      const exact = users.find(u => u.name.toLowerCase() === q.toLowerCase());
      if (exact) return navigate(`/user/${exact.seq}`);
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
          <div className="button-group">
            <Link to="/ranking" className="nav-btn">랭킹</Link>
            {loggedIn ? (
              <button className="nav-btn" onClick={handleLogout}>로그아웃</button>
            ) : (
              <button className="nav-btn" onClick={handleLogin}>Google 로그인</button>
            )}
            <button
              className="nav-btn mypage-btn"
              onClick={() => (!userSeq ? alert('로그인해주세요.') : navigate(`/user/${userSeq}`))}
            >
              마이 페이지
            </button>
            <Link to="/calc" className="nav-btn">runbility 계산기</Link>
          </div>

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

          {SHOW_DEBUG && <span className="debug-badge">DEBUG</span>}
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
