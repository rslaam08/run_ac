import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import MainPage from './pages/MainPage';
import UserPage from './pages/UserPage';
import AdminConfirm from './pages/AdminConfirm';
import RankingPage from './pages/RankingPage';
import RunbilityCalculator from './pages/RunbilityCalculator';
import './styles/global.css';
import AuthCallback from './pages/AuthCallback';

function App() {
  return (
<Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<MainPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/user/:seq" element={<UserPage />} />
          <Route path="/admin" element={<AdminConfirm />} />
          <Route path="/ranking" element={<RankingPage />} />
          <Route path="/calc" element={<RunbilityCalculator />} />
        </Route>
      </Routes>
  );
}

export default App;
