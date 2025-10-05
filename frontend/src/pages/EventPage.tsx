import React, { useEffect, useMemo, useState } from 'react';
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

type LatestLog = {
  slotId: string;
  multiplier: number;
  participants: { userSeq: number; userName: string; amount: number; payout: number }[];
} | null;

const EventPage: React.FC = () => {
  const [tab, setTab] = useState<'desc' | 'casino' | 'market'>('desc');
  const [status, setStatus] = useState<Status | null>(null);
  const [amount, setAmount] = useState('');
  const [latest, setLatest] = useState<LatestLog>(null);
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

  const loadLatest = async () => {
    try {
      const r = await eventApi.latest();
      setLatest(r.data?.latest ?? null);
    } catch {
      setLatest(null);
    }
  };

  useEffect(() => {
    loadStatus();
    loadMarket();
    loadLatest();
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

  // 다음 10분 경계(…:00, …:10, …:20, …) 계산
  const nextBoundaryMs = useMemo(() => {
    const now = new Date();
    const next = new Date(now);
    const m = now.getMinutes();
    const next10 = Math.ceil((m + (now.getSeconds() > 0 ? 1 : 0)) / 10) * 10;
    next.setMinutes(next10 % 60, 0, 0);
    if (next10 >= 60) next.setHours(now.getHours() + 1);
    return next.getTime() - now.getTime();
  }, [status?.nowSlotId]); // 대략 슬롯 바뀔 때 재계산

  // 슬롯 종료 시점에 한 번 새로고침 → 이후 10분 주기 새로고침
  useEffect(() => {
    // 첫 경계까지 한 번
    const t1 = window.setTimeout(async () => {
      await loadStatus();
      await loadLatest();
      // 이후 10분마다
      const t2 = window.setInterval(async () => {
        await loadStatus();
        await loadLatest();
      }, 10 * 60 * 1000);
      // cleanup
      return () => clearInterval(t2);
    }, Math.max(1000, nextBoundaryMs)); // 최소 1초
    return () => clearTimeout(t1);
  }, [nextBoundaryMs]);

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
          <p>이벤트 기간: 2025-10-06 ~ 2025-10-12 (KST)</p>
          <p>달리기를 해서 보름달 코인🌕을 쌓고 상품을 받아가세요!</p>
          <p></p>
          <p>🌕 획득 방법</p>
          <p>1, 달리기 기록을 올린다</p>
          <p>달리기마다 🌕 = (🌕^1.5 + (rating)^1.5)^0.667</p>
          <p>의 공식으로 🌕를 얻을 수 있어요!</p>
          <p></p>
          <p>2, 보름달 도박장에서 코인 도박을 한다</p>
          <p>도박장은 매일 밤 9시~12시에 오픈합니다!</p>
          <p>여러분은 10분마다 n 보름달 코인🌕을 걸수 있으며</p>
          <p>30% 확률로 0포인트 획득</p>
          <p>25% 확률로 0.5n포인트 획득</p>
          <p>20% 확률로 n포인트 획득</p>
          <p>15% 확률로 1.5n포인트 획득</p>
          <p>10% 확률로 2n포인트 획득</p>
          <p>4% 확률로 4n포인트 획득</p>
          <p>1% 확률로 8n포인트 획득</p>
          <p>을 보상으로 얻게 됩니다!</p>
          <p></p>
          <p>3, 코인🌕을 모은 후 보름달 상점 페이지에서 원하는 상품을 받아가세요!</p>
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
              type="button"
              onClick={async () => {
                try {
                  const n = Number(amount);
                  if (!Number.isFinite(n) || n <= 0) return alert('금액을 올바르게 입력');
                  await eventApi.bet(n);
                  alert('베팅 완료!');
                  setAmount('');
                  await loadStatus();
                } catch (e: any) {
                  alert(e?.response?.data?.error || '베팅 실패');
                }
              }}
            >
              베팅
            </button>
          </div>

          <div className="logs">
            <h3>최근 슬롯 결과</h3>
            {!latest && <div>아직 확정된 슬롯이 없습니다.</div>}
            {latest && (
              <div className="slot-log">
                <h4>
                  {latest.slotId} — 결과 x{latest.multiplier}
                </h4>
                <ul>
                  {latest.participants.map((p, idx) => (
                    <li key={`${latest.slotId}-${p.userSeq}-${idx}`}>
                      [슬롯 {latest.slotId}] {p.userName} — {p.amount.toLocaleString()}🌕 → {p.payout.toLocaleString()}🌕 (x{latest.multiplier})
                    </li>
                  ))}
                </ul>
              </div>
            )}
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
                  type="button"
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
        </section>
      )}
    </div>
  );
};

export default EventPage;
