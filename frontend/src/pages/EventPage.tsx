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
  multiplier: number | null; // 미확정이면 null
  participants: {
    userSeq: number;
    amount: number;
    payout: number | null;   // 미확정이면 null
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
      setLogs(r.data?.logs ?? []);
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

  // 자동 새로고침(선택): 30초마다 전체 로그/잔액 리프레시
  useEffect(() => {
    const id = window.setInterval(() => {
      loadStatus();
      loadAllLogs();
    }, 30000);
    return () => clearInterval(id);
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
          <p>현재 슬롯: {status?.nowSlotId} ({status?.isBettingWindow ? '베팅 가능' : '대기'})</p>

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
          </div>

          <div className="logs">
            <h3>전체 참여 로그</h3>
            {logs.length === 0 && <div>참여 로그가 없습니다.</div>}
            {logs.map((slot) => (
              <div key={slot.slotId} className="slot-log">
                <h4>
                  {slot.slotId} — 결과 {slot.multiplier == null ? '(미확정)' : `x${slot.multiplier}`}
                </h4>
                <ul>
                  {slot.participants.map((p, idx) => (
                    <li key={`${slot.slotId}-${p.userSeq}-${idx}`}>
                      user #{p.userSeq} — {p.amount.toLocaleString()}🌕
                      {' → '}
                      {p.payout == null ? '-' : `${p.payout.toLocaleString()}🌕`}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === 'market' && (
        <section className="event-section">
          <h2>보름달 마켓</h2>

          {marketError && <div className="text-red-600 text-sm mb-2">{marketError}</div>}

          {(!items || items.length === 0) && !marketError && (
            <div className="text-gray-500 text-sm mb-2">
              표시할 상품이 없습니다. (로그인 상태 또는 서버 응답을 확인하세요)
            </div>
          )}

          <div className="market-grid">
            {items.map((it) => (
              <div key={it.id} className="market-card">
                <div className="img-holder">[이미지 자리]</div>
                <div className="name">{it.name}</div>
                <div className="price">{it.price.toLocaleString()} 🌕</div>
                <button
                  disabled={!!it.bought}
                  onClick={async () => {
                    try {
                      await eventApi.buy(it.id);
                      alert('구매 완료!');
                      await loadStatus();
                      await loadMarket();
                    } catch (e: any) {
                      alert(e?.response?.data?.error || '구매 실패');
                    }
                  }}
                >
                  {it.bought ? '구매완료' : '구매'}
                </button>
              </div>
            ))}
          </div>

          {isAdmin && (
            <>
              <h3>구매 내역 (admin)</h3>
              <button onClick={loadAdminPurchases}>새로고침</button>
              <ul>
                {purchases.map((p: any) => (
                  <li key={p._id}>
                    user #{p.userSeq} — {p.itemId} — {p.price.toLocaleString()}🌕
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
    </div>
  );
};

export default EventPage;
