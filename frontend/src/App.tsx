import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';

import Layout from './components/Layout';
import MainPage from './pages/MainPage';
import UserPage from './pages/UserPage';
import AdminConfirm from './pages/AdminConfirm';
import RankingPage from './pages/RankingPage';
import RunbilityCalculator from './pages/RunbilityCalculator';
import AuthCallback from './pages/AuthCallback'; // 해시에서 토큰 파싱하는 콜백 페이지
import './styles/global.css';

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<MainPage />} />
          <Route path="/user/:seq" element={<UserPage />} />
          <Route path="/admin" element={<AdminConfirm />} />
          <Route path="/ranking" element={<RankingPage />} />
          <Route path="/calc" element={<RunbilityCalculator />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default App;
