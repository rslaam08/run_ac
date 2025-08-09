import React, { useState, useEffect, FormEvent } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import './Layout.css';
import { authApi, api, getAuthToken, clearAuthToken } from '../api/apiClient';

type SimpleUser = { seq: number; name: string };

const Header: React.FC = () => {
  const [loggedIn, setLoggedIn] = useState<boolean>(false);
  const [userSeq, setUserSeq]   = useState<number | null>(null);
  const [whoami, setWhoami]     = useState<any>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [searchBusy, setSearchBusy] = useState(false);
  const navigate = useNavigate();

  // ===== 현재 로그인 상태 확인 =====
  const refreshAuth = async () => {
    try {
      console.debug('[Header] refreshAuth() start. token?', !!getAuthToken());
      const res = await authApi.get('/me'); // Authorization: Bearer 자동 첨부
      console.debug('[Header] /auth/me ok', res.data);
      setLoggedIn(true);
      setUserSeq(res.data.seq);
      setWhoami(res.data);
    } catch (err: any) {
      console.warn('[Header] /auth/me fail', err?.response?.status, err?.response?.data);
      setLoggedIn(false);
      setUserSeq(null);
      setWhoami(null);
    }
  };

  useEffect(() => {
    refreshAuth();
  }, []);

  const handleLogin = () => {
    // 백엔드가 구글로 리다이렉트 → 로그인 성공 시 /auth/callback#token=...으로 돌아옴
    const url = `${authApi.defaults.baseURL}/google`;
    console.debug('[Header] go login:', url);
    window.location.href = url!;
  };

  const handleLogout = async () => {
    try {
      console.debug('[Header] logout(): clear token + hit /auth/logout');
      clearAuthToken(); // JWT 제거(프론트 관점에선 이걸로 충분)
      await authApi.post('/logout'); // 백엔드 세션 정리(있다면)
    } catch (e) {
      console.warn('[Header] logout call failed (ignored)', e);
    } finally {
      await refreshAuth();
      navigate('/', { replace: true });
    }
  };

  // ===== 유저 검색 =====
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
              onClick={() => {
                if (!userSeq) alert('로그인해주세요.');
                else navigate(`/user/${userSeq}`);
              }}
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
        </div>
      </div>

      {/* ====== 디버그 박스 (필요 없으면 지우세요) ====== */}
      <div style={{padding:'6px 12px', background:'#111827', color:'#E5E7EB', fontSize:12}}>
        <b>Auth debug</b> — token? {getAuthToken() ? 'yes' : 'no'} | loggedIn: {String(loggedIn)} | userSeq: {String(userSeq)}
        {whoami && (<span> | {whoami.name} (#{whoami.seq})</span>)}
        <button style={{marginLeft:8}} onClick={refreshAuth}>recheck</button>
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
