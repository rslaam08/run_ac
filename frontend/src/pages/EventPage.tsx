// frontend/src/pages/EventPage.tsx
import React, { useEffect, useState } from 'react';
import { eventApi } from '../api/apiClient';
import './EventPage.css';

type Status = {
  eventOpen: boolean;
  moon: number;
  purchases: string[];
  nowSlotId: string;
  isBettingWindow: boolean;
}

type MarketItem = {
  id: string; name: string; price: number; img: string; bought?: boolean;
}

const EventPage: React.FC = () => {
  const [tab, setTab] = useState<'desc'|'casino'|'market'>('desc');
  const [status, setStatus] = useState<Status|null>(null);
  const [amount, setAmount] = useState('');
  const [logs, setLogs] = useState<any[]>([]);
  const [items, setItems] = useState<MarketItem[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  const loadStatus = async () => {
    try {
      const r = await eventApi.status();
      setStatus(r.data);
    } catch (e:any) {
      setStatus(null);
    }
  };

  const loadMarket = async () => {
    try {
      const r = await eventApi.market();
      setItems(r.data.items);
    } catch {
      setItems([]);
    }
  };

  const loadAllLogs = async () => {
    try {
      const r = await eventApi.logsAll(); // 아래 apiClient에 추가
      setLogs(r.data.logs || []);
    } catch {
      setLogs([]);
    }
  };

  useEffect(() => {
    loadStatus();
    loadMarket();

    try {
      const t = localStorage.getItem('runac_jwt');
      if (t) {
        const [,p] = t.split('.');
        const payload = JSON.parse(atob(p.replace(/-/g,'+').replace(/_/g,'/')));
        setIsAdmin(payload?.seq === 1);
      }
    } catch {}
  }, []);

  useEffect(() => { loadAllLogs(); }, []);

  return (
    <div className="event-page">
      <div className="event-tabs">
        <button className={tab==='desc'?'active':''} onClick={()=>setTab('desc')}>추석 이벤트🌕 안내</button>
        <button className={tab==='casino'?'active':''} onClick={()=>setTab('casino')}>보름달 도박장</button>
        <button className={tab==='market'?'active':''} onClick={()=>setTab('market')}>보름달 마켓</button>
      </div>

      <div className="event-balance">
        보름달 코인 🌕: {Math.floor(status?.moon ?? 0).toLocaleString()}
      </div>

      {tab==='casino' && (
        <section className="event-section">
          <h2>보름달 도박장(즉시 결과)</h2>
          <p>각 베팅은 즉시 결과가 결정되어 정산됩니다.</p>
          <div className="bet-box">
            <input
              type="number"
              min={1}
              placeholder="베팅 금액"
              value={amount}
              onChange={(e)=>setAmount(e.target.value)}
            />
            <button
              onClick={async ()=> {
                try {
                  const n = Number(amount);
                  if (!Number.isFinite(n) || n<=0) return alert('금액을 올바르게 입력');
                  const r = await eventApi.bet(n);
                  // r.data.bet 에 multiplier/payout 있음
                  alert(`결과: x${r.data.bet.multiplier} → 지급 ${Number(r.data.bet.payout).toLocaleString()}🌕\n남은 코인: ${r.data.remain.toLocaleString()}`);
                  setAmount('');
                  await loadStatus();
                  await loadAllLogs();
                } catch (e:any) {
                  alert(e?.response?.data?.error || '베팅 실패');
                }
              }}
            >베팅</button>
          </div>

          <div className="logs">
            <h3>참여 로그 & 결과 (최근)</h3>
            {!logs.length && <div>로딩… 혹은 아직 베팅 없음</div>}
            {logs.length > 0 && (
              <table className="logs-table">
                <thead>
                  <tr>
                    <th>시간</th>
                    <th>닉네임</th>
                    <th>금액</th>
                    <th>배수</th>
                    <th>지급</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l:any) => (
                    <tr key={l._id}>
                      <td>{new Date(l.resolvedAt || l.createdAt).toLocaleString()}</td>
                      <td>{l.userName}</td>
                      <td>{Number(l.amount).toLocaleString()}🌕</td>
                      <td>{l.multiplier}x</td>
                      <td>{Number(l.payout).toLocaleString()}🌕</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      )}

      {tab==='market' && (
        <section className="event-section">
          <h2>보름달 마켓</h2>
          <div className="market-grid">
            {items.map(it=>(
              <div key={it.id} className="market-card">
                <div className="img-holder">[이미지 자리]</div>
                <div className="name">{it.name}</div>
                <div className="price">{it.price.toLocaleString()} 🌕</div>
                <button
                  disabled={!!it.bought}
                  onClick={async ()=> {
                    try {
                      await eventApi.buy(it.id);
                      alert('구매 완료!');
                      await loadStatus();
                      await loadMarket();
                    } catch (e:any) {
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
