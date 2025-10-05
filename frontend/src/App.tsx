import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, useNavigate } from 'react-router-dom';

import Layout from './components/Layout';
import MainPage from './pages/MainPage';
import UserPage from './pages/UserPage';
import AdminConfirm from './pages/AdminConfirm';
import RankingPage from './pages/RankingPage';
import RunbilityCalculator from './pages/RunbilityCalculator';
import AuthCallback from './pages/AuthCallback';
import EventPage from './pages/EventPage';
import { getAuthToken, setAuthToken } from './api/apiClient';
import './styles/global.css';

/**
 * ✅ App 초기화 로직:
 * - localStorage에 저장된 JWT를 axios 기본 헤더에 주입
 * - (혹시 누락 시 자동 복원)
 */
function useRestoreAuthToken() {
  useEffect(() => {
    const t = getAuthToken();
    if (t) {
      setAuthToken(t);
      console.debug('[App] restored auth token');
    } else {
      console.debug('[App] no token found');
    }
  }, []);
}

function AppRoutes() {
  useRestoreAuthToken();

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<MainPage />} />
        <Route path="/user/:seq" element={<UserPage />} />
        <Route path="/admin" element={<AdminConfirm />} />
        <Route path="/ranking" element={<RankingPage />} />
        <Route path="/calc" element={<RunbilityCalculator />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/event" element={<EventPage />} />
      </Route>
    </Routes>
  );
}

/**
 * ✅ HashRouter 기반 라우팅
 * - GitHub Pages 및 Render 환경에서 안전하게 작동
 */
function App() {
  return (
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  );
}

export default App;
