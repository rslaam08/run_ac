import React, { useEffect, useState } from 'react';
import { eventApi } from '../api/apiClient';
import './EventPage.css';

type Status = {
  eventOpen: boolean;
  moon: number;
  purchases: string[];
  nowSlotId: string;
  isBettingWindow: boolean;
};

type MarketItem = {
  id: string;
  name: string;
  price: number;
  img: string;
  bought?: boolean;
};

type SlotLog = {
  slotId: string;
  multiplier: number;
  participants: {
    userSeq: number;
    amount: number;
    payout: number;
  }[];
};

const EventPage: React.FC = () => {
  const [tab, setTab] = useState<'desc' | 'casino' | 'market'>('desc');
  const [status, setStatus] = useState<Status | null>(null);
  const [amount, setAmount] = useState('');
  const [logs, setLogs] = useState<SlotLog[]>([]);
  const [items, setItems] = useState<MarketItem[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [marketError, setMarketError] = useState<string | null>(null);

  const loadStatus = async () => {
    try {
      const r = await eventApi.status();
      setStatus(r.data);
    } catch {
      setStatus(null);
    }
  };

  const loadMarket = async () => {
    try {
      setMarketError(null);
      const r = await eventApi.market();
      setItems(r.data?.items ?? []);
    } catch (e: any) {
      setMarketError(e?.response?.data?.error || '마켓 불러오기 실패');
      setItems([]);
    }
  };

  const loadAllLogs = async () => {
    try {
      const r = await eventApi.allLogs();
      setLogs(r.data.logs || []);
    } catch {
      setLogs([]);
    }
  };

  const loadAdminPurchases = async () => {
    if (!isAdmin) return;
    try {
      const r = await eventApi.purchases();
      setPurchases(r.data);
    } catch {
      setPurchases([]);
    }
  };

  useEffect(() => {
    loadStatus();
    loadMarket();
    loadAllLogs();
    // JWT payload에서 seq==1 확인
    try {
      const t = localStorage.getItem('runac_jwt');
      if (t) {
        const [, p] = t.split('.');
        const payload = JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/')));
        setIsAdmin(payload?.seq === 1);
      }
    } catch {}
  }, []);

  return (
    <div className="event-page">
      <div className="event-tabs">
        <button className={tab === 'desc' ? 'active' : ''} onClick={() => setTab('desc')}>
          추석 이벤트🌕 안내
        </button>
        <button className={tab === 'casino' ? 'active' : ''} onClick={() => setTab('casino')}>
          보름달 도박장
        </button>
        <button className={tab === 'market' ? 'active' : ''} onClick={() => setTab('market')}>
          보름달 마켓
        </button>
      </div>

      <div className="event-balance">
        보름달 코인 🌕: {Math.floor(status?.moon ?? 0).toLocaleString()}
      </div>

      {tab === 'desc' && (
        <section className="event-section">
          <h2>페이지 설명</h2>
          <p>이곳에 설명을 입력하세요</p>
          <p>이벤트 기간: 2025-10-06 ~ 2025-10-12 (KST)</p>
          <p>도박장 오픈: 매일 21:00~23:59 / 각 10분 슬롯 (:01~:09 베팅, :10 결과)</p>
        </section>
      )}

      {tab === 'casino' && (
        <section className="event-section">
          <h2>보름달 도박장</h2>
          <p>
            현재 슬롯: {status?.nowSlotId} ({status?.isBettingWindow ? '베팅 가능' : '대기'})
          </p>

          <div className="bet-box">
            <input
              type="number"
              min={1}
              placeholder="베팅 금액"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <button
              onClick={async () => {
                try {
                  const n = Number(amount);
                  if (!Number.isFinite(n) || n <= 0) return alert('금액을 올바르게 입력');
                  await eventApi.bet(n);
                  alert('베팅 완료!');
                  setAmount('');
                  await loadStatus();
                  await loadAllLogs();
                } catch (e: any) {
                  alert(e?.response?.data?.error || '베팅 실패');
                }
              }}
            >
              베팅
            </button>

            <button
              onClick={async () => {
                try {
                  const r = await eventApi.resolve();
                  alert('슬롯 결과: x' + r.data.multiplier);
                  await loadStatus();
                  await loadAllLogs();
                } catch (e: any) {
