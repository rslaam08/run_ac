import React, { useState, useEffect, FormEvent } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import './Layout.css';

type SimpleUser = { seq: number; name: string };

const Header: React.FC = () => {
  const [loggedIn, setLoggedIn] = useState<boolean>(false);
  const [userSeq, setUserSeq]   = useState<number | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [searchBusy, setSearchBusy] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
  // 같은 오리진으로 배포되므로 상대 경로 사용
  fetch('/auth/me', { credentials: 'include' })
    .then(res => {
      if (res.ok) {
        res.json().then(data => {
          setLoggedIn(true);
          setUserSeq(data.seq);
        });
      } else {
        setLoggedIn(false);
        setUserSeq(null);
      }
    })
    .catch(() => {
      setLoggedIn(false);
      setUserSeq(null);
    });
  }, []);

  const handleLogin = () => {
    window.location.href = '/auth/google';
  };

  const handleLogout = () => {
    fetch('/auth/logout', { method: 'POST', credentials: 'include' })
      .then(() => (window.location.href = '/'))
      .catch(err => console.error('Logout failed', err));
  };

  // 유저 검색: /api/user 전체를 받아서 클라이언트에서 매칭
  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    const q = searchTerm.trim();
    if (!q) return;

    try {
      setSearchBusy(true);
      const res = await fetch('/api/user');
      if (!res.ok) throw new Error('failed to fetch users');
      const users: SimpleUser[] = await res.json();

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
